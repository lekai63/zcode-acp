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
import type { ZcodeAcpServer } from "../server.js";
/** ACP extension method carrying one sub-agent snapshot. */
export declare const SUBAGENT_NOTIFICATION_METHOD = "_zcode/subagent";
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
/**
 * Map every status vocabulary ZCode uses onto the card status:
 *   internal lifecycle  — spawned/stopped + `status`
 *   v3 running          — running | waiting | blocked
 *   v3 ended            — success | failed | cancelled | lost
 *   background runtime  — completed | failed | stopped | timed_out | spawn_error
 */
export declare function mapSubagentStatus(raw: unknown, phase: "spawned" | "stopped"): SubagentStatus;
/**
 * Follows sub-agents for ONE parent session. Registered alongside the
 * background-task listener, so it survives across prompts and keeps reporting
 * agents that outlive the turn that launched them.
 */
export declare class SubagentTracker implements EventListener {
    private readonly server;
    readonly zcodeSid: string;
    private readonly byAgentId;
    /** Dispatch call id → agent, so terminal events (which omit toolName) bind. */
    private readonly byParentToolCallId;
    /** Child tool names (mirrors omit `toolName` after the first event). */
    private readonly childToolNames;
    /** Child tool summaries, so a terminal line can repeat its call's summary. */
    private readonly childToolSummaries;
    /**
     * `Agent`/`Task` dispatch call ids seen on a `scheduled`/`started` event.
     * Needed because the terminal (`result`/`error`) events omit `toolName`.
     */
    private readonly dispatchCallIds;
    private refreshTimer;
    private refreshInFlight;
    constructor(server: ZcodeAcpServer, zcodeSid: string);
    /** Parent-session event entry point. */
    handleEvent(event: ZcodeEvent): void;
    /** All tracked agents (used by tests + shutdown records). */
    agents(): SubagentNotificationPayload[];
    /**
     * Terminal records for agents still running at bridge shutdown, so their
     * cards do not stay in_progress forever. Best-effort.
     */
    emitShutdownRecords(): Promise<void>;
    /**
     * A `tool.updated` mirrored from a CHILD session into the parent stream:
     * `{source:"subagent", agentId, agentType, childSessionId, childToolCallId,
     *   parentToolCallId, description, background, toolCallId:"tool_subagent_…"}`.
     */
    private onMirroredTool;
    /**
     * Parent `tool.updated` for the dispatch itself: bind the dispatch call id to
     * the agent (so the card merges with the client's existing tool card) and
     * pick up the usage markers the result carries.
     *
     * `result`/`error` events OMIT `toolName` (same quirk the event translator
     * caches names for), so the call is attributed through the call ids seen on
     * `scheduled`/`started` and through the agents the mirrors already bound.
     */
    private onParentTool;
    private onLifecycle;
    private onSubagentMessage;
    /**
     * `state.updated` may carry a `subagents` patch
     * (`{revision, childSessionIds, running, endedTotal}` in the v4 shape). The
     * v3 wire declares `patch` as `unknown`, so read it defensively.
     */
    private onStateUpdated;
    private scheduleRefresh;
    /**
     * Pull `session/subagents` — the authoritative running+ended directory. Also
     * the only path that reports agents which finished before we attached, and
     * the only source of title/subagentType/summary for agents whose mirrored
     * events we joined late.
     */
    refreshFromProtocol(): Promise<void>;
    /**
     * One directory entry:
     * `{childSessionId, agentId?, toolCallId?, subagentType, title, summary?,
     *   startedAt?, endedAt?, status}`.
     */
    private mergeDirectoryItem;
    private upsert;
    private finalize;
    private appendLine;
    /**
     * Append, or rewrite the existing line with this key in place. Used by child
     * tool lines: the "done"/"failed" outcome replaces the call's start line so
     * one call stays one log line, keeping the position it first appeared at.
     */
    private upsertLine;
    private payloadFor;
    /** Trailing-edge throttle: coalesce bursts, never drop the final state. */
    private requestEmit;
    private emitNow;
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
export declare function parseSubagentResultMeta(rawResult: unknown): {
    agentId?: string;
    tokens?: number;
    toolUses?: number;
    durationMs?: number;
};
//# sourceMappingURL=subagents.d.ts.map