/**
 * Session-scoped sub-agent tracker.
 *
 * ZCode runs every `Agent`/`Task` dispatch as a CHILD session
 * (`sess_subagent_agent_<uuid>`, `task_type:"subagent_child"`). None of that
 * reaches an ACP client today: `EventTranslator` only understands
 * turn/model/tool/state events, so a sub-agent's inner work — its own tool
 * calls, its status, its token usage — is invisible beyond the single dispatch
 * card. Worse, the child's tool activity is MIRRORED into the parent's event
 * stream (`source:"subagent"`, `toolCallId:"tool_subagent_<agentId>_<childId>"`,
 * see `core/src/subagent/tool-event-mirror.ts`) and the bridge was rendering
 * those as if the MAIN agent had run them.
 *
 * This tracker closes both gaps without inventing a second ACP surface:
 *
 *   1. Mirrored `tool.updated` events on the PARENT stream are folded into one
 *      compact `[Tool] summary` log per sub-agent (they are filtered out of the
 *      ordinary dispatch — see the guard in `translators/event-translator.ts`).
 *   2. `session/subagents` — the authoritative directory (it reads child
 *      sessions straight from the store) — supplies title/type/status/summary
 *      and covers agents whose events predate our listener.
 *   3. The result is published as a VENDOR notification (`_zcode/subagent`), an
 *      ACP extension method: editors that do not know it ignore unknown
 *      notifications, while the Paseo plugin's `AcpTransformer.notification`
 *      maps it onto a `sub_agent` timeline card (`ProviderToolCallDetail`) —
 *      the only way a plugin can render a sub-agent, since Paseo's
 *      `provider_subagent` stream events are not part of the plugin contract.
 *
 * The card is keyed by `parentToolCallId` so it merges with the ACP tool card
 * the client already has for the `Agent`/`Task` dispatch (Paseo keeps a
 * non-`unknown` tool detail when a later update arrives for the same callId).
 *
 * Everything here is best-effort: failures are logged via `warn()`/`log()` and
 * never thrown into the event loop (a throw would kill the bridge, per
 * AGENTS.md).
 */

import type { EventListener } from "../backend/client.js";
import type { ZcodeEvent } from "../backend/types.js";
import { log, warn } from "../utils.js";
import type { ZcodeAcpServer } from "../server.js";
import { summarizeToolInput } from "../translators/tool-helpers.js";

/** ACP extension method carrying one sub-agent snapshot. */
export const SUBAGENT_NOTIFICATION_METHOD = "_zcode/subagent";

/** Throttle window for per-agent emissions (trailing edge), mirroring omp. */
const THROTTLE_INTERVAL_MS = 500;
const MAX_LOG_LINES = 200;
const MAX_LINE_CHARS = 240;
const SUBAGENT_REFRESH_TIMEOUT_MS = 5_000;
/** `session/subagents` refresh coalescing window (spawn/result bursts). */
const REFRESH_DEBOUNCE_MS = 750;

export type SubagentStatus = "running" | "completed" | "failed" | "canceled";

export interface SubagentNotificationPayload {
  /** Parent (backend) session id this sub-agent belongs to. */
  sessionId: string;
  agentId: string;
  agentType?: string;
  childSessionId?: string;
  parentToolCallId?: string;
  title?: string;
  status: SubagentStatus;
  background: boolean;
  startedAt?: number;
  endedAt?: number;
  summary?: string;
  errorMessage?: string;
  /** Full activity log, oldest first (de-duplicated + capped). */
  log: string[];
  tokens?: number;
  toolUses?: number;
  durationMs?: number;
  revision: number;
}

interface LogLine {
  key: string;
  text: string;
}

interface TrackedSubagent {
  agentId: string;
  agentType?: string;
  childSessionId?: string;
  parentToolCallId?: string;
  title?: string;
  description?: string;
  status: SubagentStatus;
  background: boolean;
  startedAt?: number;
  endedAt?: number;
  summary?: string;
  errorMessage?: string;
  tokens?: number;
  toolUses?: number;
  durationMs?: number;
  lines: LogLine[];
  lineKeys: Set<string>;
  revision: number;
  lastEmitMs: number | null;
  trailingTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
  /** True once the protocol directory reported this agent (avoids re-merging). */
  seenInProjection: boolean;
}

/**
 * Map every status vocabulary ZCode uses onto the card status:
 *   internal lifecycle  — spawned/stopped + `status`
 *   v3 running          — running | waiting | blocked
 *   v3 ended            — success | failed | cancelled | lost
 *   background runtime  — completed | failed | stopped | timed_out | spawn_error
 */
export function mapSubagentStatus(raw: unknown, phase: "spawned" | "stopped"): SubagentStatus {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  switch (value) {
    case "failed":
    case "error":
    case "errored":
    case "lost":
    case "timed_out":
    case "spawn_error":
      return "failed";
    case "canceled":
    case "cancelled":
    case "aborted":
    case "stopped":
      return "canceled";
    case "success":
    case "succeeded":
    case "completed":
      return "completed";
    case "running":
    case "waiting":
    case "blocked":
    case "pending":
    case "started":
      return "running";
    default:
      // No status on a stop event means it ended; a spawn without status runs.
      return phase === "stopped" ? "completed" : "running";
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Collapse whitespace + truncate; undefined for blank input. */
function normalizeLine(value: string): string | undefined {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return undefined;
  return collapsed.length <= MAX_LINE_CHARS ? collapsed : `${collapsed.slice(0, MAX_LINE_CHARS)}...`;
}

/**
 * Follows sub-agents for ONE parent session. Registered alongside the
 * background-task listener, so it survives across prompts and keeps reporting
 * agents that outlive the turn that launched them.
 */
export class SubagentTracker implements EventListener {
  private readonly server: ZcodeAcpServer;
  readonly zcodeSid: string;
  private readonly byAgentId = new Map<string, TrackedSubagent>();
  /** Dispatch call id → agent, so terminal events (which omit toolName) bind. */
  private readonly byParentToolCallId = new Map<string, TrackedSubagent>();
  /** Child tool names (mirrors omit `toolName` after the first event). */
  private readonly childToolNames = new Map<string, string>();
  /** Child tool summaries, so a terminal line can repeat its call's summary. */
  private readonly childToolSummaries = new Map<string, string>();
  /**
   * `Agent`/`Task` dispatch call ids seen on a `scheduled`/`started` event.
   * Needed because the terminal (`result`/`error`) events omit `toolName`.
   */
  private readonly dispatchCallIds = new Set<string>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshInFlight = false;

  constructor(server: ZcodeAcpServer, zcodeSid: string) {
    this.server = server;
    this.zcodeSid = zcodeSid;
  }

  /** Parent-session event entry point. */
  handleEvent(event: ZcodeEvent): void {
    try {
      const payload = asRecord(event.payload);
      // Widened to string: the `subagent_*` lifecycle types are INTERNAL today
      // (absent from the wire `session/event` union), so they cannot appear in
      // the ZcodeEventType switch — the cases below stay as a cheap forward
      // compatibility path for a backend build that starts emitting them.
      const type: string = event.type;
      switch (type) {
        case "tool.updated":
          if (readString(payload["source"]) === "subagent") this.onMirroredTool(payload);
          else this.onParentTool(payload);
          return;
        case "state.updated":
          this.onStateUpdated(payload);
          return;
        case "turn.completed":
        case "turn.failed":
          // End of every parent turn: reconcile against the directory, which
          // also reports agents whose events we never saw.
          this.scheduleRefresh(0);
          return;
        // Defensive: these lifecycle events are INTERNAL today (they are not in
        // the wire `session/event` union), but handling them costs nothing and
        // keeps the tracker correct if a backend build starts emitting them.
        case "subagent_spawned":
          this.onLifecycle(payload, "spawned");
          return;
        case "subagent_stopped":
          this.onLifecycle(payload, "stopped");
          return;
        case "subagent_message":
          this.onSubagentMessage(payload);
          return;
        default:
          return;
      }
    } catch (e) {
      warn(`SubagentTracker: event handling failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** All tracked agents (used by tests + shutdown records). */
  agents(): SubagentNotificationPayload[] {
    return [...this.byAgentId.values()].map((agent) => this.payloadFor(agent));
  }

  /**
   * Terminal records for agents still running at bridge shutdown, so their
   * cards do not stay in_progress forever. Best-effort.
   */
  async emitShutdownRecords(): Promise<void> {
    for (const agent of this.byAgentId.values()) {
      if (agent.status !== "running") continue;
      // finalize() appends the terminal log line and forces the emission.
      await this.finalize(agent, "canceled", "bridge shutdown");
    }
  }

  // ---------- mirrored child activity (the live log) ----------

  /**
   * A `tool.updated` mirrored from a CHILD session into the parent stream:
   * `{source:"subagent", agentId, agentType, childSessionId, childToolCallId,
   *   parentToolCallId, description, background, toolCallId:"tool_subagent_…"}`.
   */
  private onMirroredTool(payload: Record<string, unknown>): void {
    const agentId = readString(payload["agentId"]);
    if (!agentId) return;
    const childToolCallId = readString(payload["childToolCallId"]);
    const agent = this.upsert(agentId, {
      agentType: readString(payload["agentType"]),
      childSessionId: readString(payload["childSessionId"]),
      parentToolCallId: readString(payload["parentToolCallId"]),
      description: readString(payload["description"]),
      background: readBoolean(payload["background"]),
    });
    if (agent.description && !agent.title) agent.title = agent.description;

    const kind = readString(payload["kind"]) ?? "";
    const toolName = readString(payload["toolName"]);
    const key = `${agentId}:${childToolCallId ?? ""}`;
    if (toolName && childToolCallId) this.childToolNames.set(key, toolName);
    const name = toolName ?? (childToolCallId ? this.childToolNames.get(key) : undefined) ?? "";
    if (!childToolCallId) return;
    const lineKey = `tool:${childToolCallId}`;

    if (kind === "scheduled" || kind === "started") {
      const summary = summarizeToolInput(name, payload["input"]);
      if (summary) this.childToolSummaries.set(key, summary);
      // Same key as the terminal line below: a finished call REPLACES its
      // start line instead of adding a second one (the mirror delivers the
      // events of concurrent child calls batched, so a start/end pair per call
      // would interleave into an unreadable log).
      this.upsertLine(agent, lineKey, `[${name || "tool"}]${summary ? ` ${summary}` : ""}`);
      // First sighting of an agent with no directory entry yet: the child
      // session is live, so learn its type/title from the projection.
      if (!agent.seenInProjection) this.scheduleRefresh();
      this.requestEmit(agent);
      return;
    }
    if (kind === "result") {
      const failed = asRecord(payload["result"])["success"] === false;
      const summary = this.childToolSummaries.get(key) ?? summarizeToolInput(name, payload["input"]);
      this.upsertLine(
        agent,
        lineKey,
        `[${name || "tool"}]${summary ? ` ${summary}` : ""} · ${failed ? "failed" : "done"}`,
      );
      this.requestEmit(agent);
      return;
    }
    if (kind === "error") {
      const summary = this.childToolSummaries.get(key) ?? summarizeToolInput(name, payload["input"]);
      this.upsertLine(
        agent,
        lineKey,
        `[${name || "tool"}]${summary ? ` ${summary}` : ""} · failed`,
      );
      this.requestEmit(agent);
    }
  }

  // ---------- the parent's own Agent/Task dispatch ----------

  /**
   * Parent `tool.updated` for the dispatch itself: bind the dispatch call id to
   * the agent (so the card merges with the client's existing tool card) and
   * pick up the usage markers the result carries.
   *
   * `result`/`error` events OMIT `toolName` (same quirk the event translator
   * caches names for), so the call is attributed through the call ids seen on
   * `scheduled`/`started` and through the agents the mirrors already bound.
   */
  private onParentTool(payload: Record<string, unknown>): void {
    const toolName = readString(payload["toolName"]) ?? "";
    const isDispatchName = toolName === "Agent" || toolName === "Task";
    const callId = readString(payload["toolCallId"]);
    const kind = readString(payload["kind"]);

    if (isDispatchName && callId) this.dispatchCallIds.add(callId);

    if (kind !== "result" && kind !== "error") {
      if (isDispatchName && (kind === "scheduled" || kind === "started")) this.scheduleRefresh();
      return;
    }
    if (!callId) return;
    if (!isDispatchName && !this.dispatchCallIds.has(callId) && !this.byParentToolCallId.has(callId)) {
      // A result for some other tool — not a sub-agent dispatch.
      return;
    }

    const meta = parseSubagentResultMeta(payload["result"] ?? payload["error"]);
    if (meta.agentId) {
      const agent = this.upsert(meta.agentId, { parentToolCallId: callId });
      if (meta.tokens !== undefined) agent.tokens = meta.tokens;
      if (meta.toolUses !== undefined) agent.toolUses = meta.toolUses;
      if (meta.durationMs !== undefined) agent.durationMs = meta.durationMs;
      this.requestEmit(agent);
    }
    // The directory is authoritative for the agents this dispatch produced.
    this.scheduleRefresh(0);
  }

  // ---------- defensive lifecycle paths ----------

  private onLifecycle(payload: Record<string, unknown>, phase: "spawned" | "stopped"): void {
    const agentId = readString(payload["agentId"]);
    if (!agentId) return;
    const agent = this.upsert(agentId, {
      agentType: readString(payload["agentType"]),
      childSessionId: readString(payload["childSessionId"]),
      parentToolCallId: readString(payload["parentToolCallId"]),
      background: readBoolean(payload["background"]),
    });
    if (phase === "spawned") {
      agent.startedAt ??= Date.now();
      this.appendLine(
        agent,
        `lifecycle:spawned:${agentId}`,
        `spawned${agent.agentType ? ` · ${agent.agentType}` : ""}${agent.background ? " · background" : ""}`,
      );
      this.requestEmit(agent);
      this.scheduleRefresh();
    } else {
      void this.finalize(
        agent,
        mapSubagentStatus(payload["status"], "stopped"),
        readString(payload["error"]),
      );
    }
  }

  private onSubagentMessage(payload: Record<string, unknown>): void {
    const agentId = readString(payload["agentId"]);
    if (!agentId) return;
    const agent = this.upsert(agentId, {
      agentType: readString(payload["agentType"]),
      childSessionId: readString(payload["childSessionId"]),
      parentToolCallId: readString(payload["parentToolCallId"]),
    });
    const text = readString(payload["summary"]) ?? readString(payload["message"]);
    if (text) {
      agent.summary = text;
      this.appendLine(agent, `message:${agent.lines.length}`, text);
    }
    this.requestEmit(agent);
  }

  /**
   * `state.updated` may carry a `subagents` patch
   * (`{revision, childSessionIds, running, endedTotal}` in the v4 shape). The
   * v3 wire declares `patch` as `unknown`, so read it defensively.
   */
  private onStateUpdated(payload: Record<string, unknown>): void {
    const patch = asRecord(payload["patch"]);
    const subagents = asRecord(patch["subagents"]);
    const running = subagents["running"];
    if (!Array.isArray(running)) return;
    for (const item of running) this.mergeDirectoryItem(item, "running");
  }

  // ---------- protocol directory ----------

  private scheduleRefresh(delayMs = REFRESH_DEBOUNCE_MS): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshFromProtocol();
    }, delayMs);
    // Never keep the process alive for a refresh.
    this.refreshTimer.unref?.();
  }

  /**
   * Pull `session/subagents` — the authoritative running+ended directory. Also
   * the only path that reports agents which finished before we attached, and
   * the only source of title/subagentType/summary for agents whose mirrored
   * events we joined late.
   */
  async refreshFromProtocol(): Promise<void> {
    if (this.refreshInFlight) return;
    const backend = this.server.currentBackend();
    if (!backend || backend.isDead) return;
    this.refreshInFlight = true;
    try {
      const resp = await backend.request(
        this.server.nextId(),
        "session/subagents",
        { sessionId: this.zcodeSid, endedLimit: 20 },
        SUBAGENT_REFRESH_TIMEOUT_MS,
      );
      if (resp.error) {
        log(`  [subagent] session/subagents unavailable: ${resp.error.message ?? "unknown error"}`);
        return;
      }
      const result = asRecord(resp.result);
      const running = Array.isArray(result["running"]) ? result["running"] : [];
      const ended = asRecord(result["ended"])["items"];
      for (const item of running) this.mergeDirectoryItem(item, "running");
      if (Array.isArray(ended)) for (const item of ended) this.mergeDirectoryItem(item, "ended");
    } catch (e) {
      log(`  [subagent] refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.refreshInFlight = false;
    }
  }

  /**
   * One directory entry:
   * `{childSessionId, agentId?, toolCallId?, subagentType, title, summary?,
   *   startedAt?, endedAt?, status}`.
   */
  private mergeDirectoryItem(item: unknown, bucket: "running" | "ended"): void {
    const entry = asRecord(item);
    const childSessionId = readString(entry["childSessionId"]);
    const agentId = readString(entry["agentId"]) ?? childSessionId;
    if (!agentId) return;

    const agent = this.upsert(agentId, {
      childSessionId,
      parentToolCallId: readString(entry["toolCallId"]),
      agentType: readString(entry["subagentType"]),
      title: readString(entry["title"]),
      startedAt: readNumber(entry["startedAt"]),
    });
    agent.seenInProjection = true;
    agent.summary ??= readString(entry["summary"]);
    if (bucket === "ended") {
      const status = mapSubagentStatus(entry["status"], "stopped");
      agent.endedAt ??= readNumber(entry["endedAt"]);
      if (agent.status === "running") void this.finalize(agent, status);
      return;
    }
    // Running bucket: only promote a status we have never seen move.
    if (agent.status !== "running") return;
    this.requestEmit(agent);
  }

  // ---------- state ----------

  private upsert(
    agentId: string,
    patch: {
      agentType?: string;
      childSessionId?: string;
      parentToolCallId?: string;
      description?: string;
      background?: boolean;
      status?: SubagentStatus;
      title?: string;
      startedAt?: number;
    },
  ): TrackedSubagent {
    let agent = this.byAgentId.get(agentId);
    if (!agent) {
      agent = {
        agentId,
        status: "running",
        background: false,
        lines: [],
        lineKeys: new Set(),
        revision: 0,
        lastEmitMs: null,
        trailingTimer: null,
        dirty: false,
        seenInProjection: false,
        startedAt: Date.now(),
      };
      this.byAgentId.set(agentId, agent);
    }
    if (patch.agentType) agent.agentType = patch.agentType;
    if (patch.title) agent.title = patch.title;
    if (patch.description && !agent.description) agent.description = patch.description;
    if (patch.childSessionId) agent.childSessionId = patch.childSessionId;
    if (patch.parentToolCallId) {
      agent.parentToolCallId = patch.parentToolCallId;
      this.byParentToolCallId.set(patch.parentToolCallId, agent);
    }
    if (patch.background !== undefined && patch.background) agent.background = true;
    if (patch.startedAt !== undefined) agent.startedAt ??= patch.startedAt;
    if (patch.status && agent.status === "running") agent.status = patch.status;
    return agent;
  }

  private async finalize(
    agent: TrackedSubagent,
    status: SubagentStatus,
    detail?: string,
  ): Promise<void> {
    if (agent.status !== "running") return;
    agent.status = status === "running" ? "completed" : status;
    agent.endedAt ??= Date.now();
    if (detail && status === "failed") agent.errorMessage = detail;
    this.appendLine(
      agent,
      `lifecycle:stopped:${agent.agentId}`,
      `stopped · ${agent.status}${detail ? ` · ${detail}` : ""}`,
    );
    // Terminal transitions must not wait out the throttle window.
    await this.emitNow(agent);
  }

  // ---------- log + emission ----------

  private appendLine(agent: TrackedSubagent, key: string, raw: string): void {
    const text = normalizeLine(raw);
    if (!text || agent.lineKeys.has(key)) return;
    agent.lines.push({ key, text });
    agent.lineKeys.add(key);
    while (agent.lines.length > MAX_LOG_LINES) {
      const removed = agent.lines.shift();
      if (removed) agent.lineKeys.delete(removed.key);
    }
  }

  /**
   * Append, or rewrite the existing line with this key in place. Used by child
   * tool lines: the "done"/"failed" outcome replaces the call's start line so
   * one call stays one log line, keeping the position it first appeared at.
   */
  private upsertLine(agent: TrackedSubagent, key: string, raw: string): void {
    const text = normalizeLine(raw);
    if (!text) return;
    const existing = agent.lines.find((line) => line.key === key);
    if (existing) {
      existing.text = text;
      return;
    }
    this.appendLine(agent, key, text);
  }

  private payloadFor(agent: TrackedSubagent): SubagentNotificationPayload {
    return {
      sessionId: this.zcodeSid,
      agentId: agent.agentId,
      ...(agent.agentType ? { agentType: agent.agentType } : {}),
      ...(agent.childSessionId ? { childSessionId: agent.childSessionId } : {}),
      ...(agent.parentToolCallId ? { parentToolCallId: agent.parentToolCallId } : {}),
      ...(agent.title ? { title: agent.title } : {}),
      status: agent.status,
      background: agent.background,
      ...(agent.startedAt !== undefined ? { startedAt: agent.startedAt } : {}),
      ...(agent.endedAt !== undefined ? { endedAt: agent.endedAt } : {}),
      ...(agent.summary ? { summary: agent.summary } : {}),
      ...(agent.errorMessage ? { errorMessage: agent.errorMessage } : {}),
      ...(agent.tokens !== undefined ? { tokens: agent.tokens } : {}),
      ...(agent.toolUses !== undefined ? { toolUses: agent.toolUses } : {}),
      ...(agent.durationMs !== undefined ? { durationMs: agent.durationMs } : {}),
      log: agent.lines.map((line) => line.text),
      revision: agent.revision,
    };
  }

  /** Trailing-edge throttle: coalesce bursts, never drop the final state. */
  private requestEmit(agent: TrackedSubagent): void {
    const now = Date.now();
    const elapsed = agent.lastEmitMs === null ? THROTTLE_INTERVAL_MS : now - agent.lastEmitMs;
    if (elapsed >= THROTTLE_INTERVAL_MS) {
      void this.emitNow(agent);
      return;
    }
    agent.dirty = true;
    if (agent.trailingTimer) return;
    agent.trailingTimer = setTimeout(() => {
      agent.trailingTimer = null;
      if (agent.dirty) void this.emitNow(agent);
    }, THROTTLE_INTERVAL_MS - elapsed);
    agent.trailingTimer.unref?.();
  }

  private async emitNow(agent: TrackedSubagent): Promise<void> {
    if (agent.trailingTimer) {
      clearTimeout(agent.trailingTimer);
      agent.trailingTimer = null;
    }
    agent.dirty = false;
    agent.lastEmitMs = Date.now();
    agent.revision += 1;
    try {
      await this.server.notifyVendorByZcodeSid(
        this.zcodeSid,
        SUBAGENT_NOTIFICATION_METHOD,
        this.payloadFor(agent) as unknown as Record<string, unknown>,
      );
    } catch (e) {
      warn(`SubagentTracker: emit failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/**
 * Structured markers ZCode appends to an `Agent`/`Task` result:
 * `agentId: agent_xxx (use SendMessage …)` and
 * `<usage>subagent_tokens: 40904\ntool_uses: 1\nduration_ms: 10559</usage>`.
 *
 * The result reaches the event stream in more than one wrapper shape (a plain
 * string, `{content: string}`, or content blocks), and the usage may also be
 * present as structured fields — all of them are accepted here so the card gets
 * its usage numbers regardless of the build.
 */
export function parseSubagentResultMeta(rawResult: unknown): {
  agentId?: string;
  tokens?: number;
  toolUses?: number;
  durationMs?: number;
} {
  const meta: { agentId?: string; tokens?: number; toolUses?: number; durationMs?: number } = {};
  const text = subagentResultText(rawResult);
  if (text) {
    const agentId = text.match(/agentId:\s*(agent_[A-Za-z0-9-]+)/);
    if (agentId) meta.agentId = agentId[1];
    const usage = text.match(
      /<usage>\s*subagent_tokens:\s*(\d+)\s*tool_uses:\s*(\d+)\s*duration_ms:\s*(\d+)\s*<\/usage>/,
    );
    if (usage) {
      meta.tokens = Number(usage[1]);
      meta.toolUses = Number(usage[2]);
      meta.durationMs = Number(usage[3]);
    }
  }

  // Structured fallbacks (`AgentCompletedOutput` as an object).
  const record = asRecord(rawResult);
  meta.agentId ??= readString(record["agentId"]);
  meta.tokens ??= readNumber(record["totalTokens"]);
  meta.toolUses ??= readNumber(record["totalToolUseCount"]);
  meta.durationMs ??= readNumber(record["totalDurationMs"]);
  return meta;
}

/**
 * Best-effort extraction of the readable result text. Falls back to the
 * serialized form (with escaped newlines unescaped) because the markers are
 * plain text inside whatever wrapper the backend chose.
 */
function subagentResultText(rawResult: unknown): string | undefined {
  if (typeof rawResult === "string") return rawResult;
  if (!rawResult || typeof rawResult !== "object") return undefined;
  const record = asRecord(rawResult);
  const content = record["content"];
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const joined = content
      .map((block) => (typeof block === "string" ? block : readString(asRecord(block)["text"])))
      .filter((part): part is string => Boolean(part))
      .join("\n");
    if (joined) return joined;
  }
  const output = record["output"];
  if (typeof output === "string") return output;
  if (output && typeof output === "object") return subagentResultText(output);
  try {
    const json = JSON.stringify(rawResult);
    return json ? json.replace(/\\n/g, "\n") : undefined;
  } catch {
    return undefined;
  }
}
