/**
 * Session lifecycle handlers: initialize, new, list, resume, load, prompt, cancel.
 *
 * These map ACP session methods to ZCode app-server calls. `session/new` is
 * lazy: it returns a placeholder id and defers zcode `session/create` to the
 * session's first use (`ensureRealSession`), so an editor startup that never
 * prompts leaves no empty session in the backend or the App's task index.
 * `session/prompt` runs the event-driven turn loop (subscribe-before-send
 * ordering, no-progress timeout, stall reconciliation). ZCode events are
 * translated via EventTranslator and dispatched as ACP `session/update`
 * notifications.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeBackend } from "../backend/client.js";
import { EventStreamListener, TurnMonitor } from "../backend/listener.js";
import type { ZcodeMessage } from "../backend/types.js";
import { EventTranslator, ProjectionDiffer } from "../translators/index.js";
import type { PendingTurn, ZcodeAcpServer } from "../server.js";
/**
 * Cold-bridge menu catch-up: the `/` menu snapshot sent at session/new is
 * filtered against the workflow gate, and on a COLD bridge (lazy session/new,
 * no backend yet) that snapshot was taken while the gate was still
 * pending/absent — the two workflow commands get dropped for that whole
 * session. By the time a lazy session MATERIALIZES the gate has necessarily
 * settled (create/resume params awaited it), so re-send the menu here.
 * Overwrite semantics + the deferred helper's timer cancellation make this
 * idempotent and correctly ordered (a late settle supersedes the stale send).
 */
export declare function resendMenuAfterGateSettled(server: ZcodeAcpServer, acpSid: string): void;
/**
 * Read and consume the boot-resume session id: the first `session/new` after
 * process start claims it, the env is deleted so later `session/new` calls
 * (the TUI's /new) create fresh sessions. Whitespace-only counts as unset.
 */
export declare function consumeBootResumeTarget(): string | null;
/**
 * Banner-handshake trigger for a boot-resumed TUI (ADR-0017 follow-up).
 * Martty's welcome banner paints INSTEAD of the transcript and only dives
 * when text is submitted — so a boot-resumed TUI showed its replayed history
 * only after the user's first message. The hub therefore also incubates the
 * resume TUI with `DSH_TUI_AUTOPROMPT=<this string>`: martty auto-submits it
 * at boot (banner dives immediately, the text queues until the boot bind),
 * and the prompt path answers it with a one-line ack instead of a model
 * turn — scoped to the booting connection (see bootResumeTriggerConnection).
 * Plain text on purpose: a leading `/` would route through martty's
 * slash dispatch (whose gates run before agent capabilities are known) and
 * `!` would run a local shell command.
 */
export declare const BOOT_RESUME_TRIGGER = "resume session";
/**
 * `session/new` → local placeholder id. The real zcode `session/create` is
 * deferred to first use (`ensureRealSession`) so an editor startup that never
 * sends a message leaves no empty session in the backend or the App's task
 * index. The created session uses mode yolo (hardcoded).
 *
 * Exception — boot-resume interception (ADR-0017, amended by ADR-0020): when
 * the hub incubated this bridge for a specific conversation
 * (ZCODE_ACP_RESUME_SESSION), the TUI client's opening `session/new` is
 * served as a `session/load` of that id instead. The client adopts the
 * resumed conversation with zero client-side support. A failed load falls
 * back to a fresh session so the window still lands on a usable prompt
 * (the retired in-house REPL had the same fallback).
 */
export declare function newSession(server: ZcodeAcpServer, params: acp.NewSessionRequest, client?: acp.AgentContext): Promise<acp.NewSessionResponse>;
/**
 * Materialize a lazy `session/new` placeholder into a real backend session on
 * first use (prompt / set_config_option / extension methods). Idempotent:
 * returns the existing mapping for already-created sessions, and concurrent
 * first-uses share a single `session/create` via the pending entry's `creating`
 * promise. Unknown ids throw.
 *
 * `{ensureResident:false}` (resolveResumeTarget only) skips the eviction
 * guard for store-recovered mappings — that caller resumes the session itself
 * immediately after, and its resume must be the one carrying the client's
 * freshly declared mcpServers (#193).
 */
export declare function ensureRealSession(server: ZcodeAcpServer, acpSid: string, opts?: {
    ensureResident?: boolean;
}): Promise<string>;
/** `session/list` → zcode `session/list`. */
export declare function listSessions(server: ZcodeAcpServer, params: acp.ListSessionsRequest): Promise<acp.ListSessionsResponse>;
/** `session/resume` → zcode `session/resume` (with runtimeModel overlay). */
export declare function resumeSession(server: ZcodeAcpServer, params: acp.ResumeSessionRequest, cx: acp.AgentContext): Promise<acp.ResumeSessionResponse>;
/**
 * `/resume` slash command: rebind the CURRENT ACP session (an editor thread)
 * to an existing backend session and replay its history into that thread —
 * the editor-side path for adopting a conversation started elsewhere (TUI /
 * App), complementing Zed's Import Threads (which needs a manual import
 * step). Only an EMPTY thread may adopt: a thread that already has a
 * conversation can neither merge nor replace history cleanly (the editor has
 * already rendered its own copy).
 *
 * Mirrors the alreadyLive-branch tail of `session/load`: provider registry →
 * faithful resume → mapping + cwd → title adoption → full-history replay →
 * differ baseline + plan/usage emission.
 */
export declare function resumeIntoSession(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeTarget: string): Promise<{
    ok: true;
    title: string | undefined;
} | {
    ok: false;
    error: string;
}>;
/**
 * `session/load` → zcode `session/resume` + stream conversation history back as
 * `session/update` notifications (text/reasoning/简化 tool_call).
 */
export declare function loadSession(server: ZcodeAcpServer, params: acp.LoadSessionRequest, cx: acp.AgentContext, opts?: {
    replayHistory?: boolean;
}): Promise<acp.LoadSessionResponse>;
/**
 * `session/prompt` → subscribe-before-send, run the event-driven turn loop.
 *
 * Sandbox allow-restart chaining (ADR-0011): when a turn unwinds as cancelled
 * because the user approved a new writable root (the backend was killed to be
 * respawned under the widened profile), the continuation prompt runs INSIDE
 * this same request via runPrompt. The editor's spinner then spans the
 * respawn+reload window and the resumed work renders as the same turn. A
 * detached follow-up prompt (the previous design) has no pending editor
 * request behind it, so the editor showed no running state for it at all —
 * the window read as "it just stopped", any message typed there preempted
 * the continuation for real, and only the session/load replay later surfaced
 * the orphaned continuation bubble.
 */
export declare function prompt(server: ZcodeAcpServer, params: acp.PromptRequest, cx: acp.AgentContext, requestId: number | string, client?: acp.AgentContext): Promise<acp.PromptResponse>;
/**
 * Options for {@link runOneTurn}: everything the round machinery needs that
 * is not derivable from the server/session pair. `turn` MUST already be
 * registered in `server.pendingTurns` under `requestId` by the caller (the
 * prompt path does it inside withPreemptLock; the goal-loop driver likewise).
 */
export interface RunOneTurnOptions {
    backend: ZcodeBackend;
    cx: acp.AgentContext;
    acpSid: string;
    zcodeSid: string;
    requestId: number | string;
    turn: PendingTurn;
    /** True when this send cancelled another in-flight prompt (gates attribution). */
    preempted: boolean;
    /** Wire text for the backend send (slash-neutralized on the prompt path). */
    sendText: string;
    attachments?: unknown[];
    /** Sandbox allow-restart continuation round (emits the resumed status line). */
    continuationRound?: boolean;
    /** Run the env-gated maybeAutoCompact after an end_turn. Default true. */
    autoCompact?: boolean;
}
/**
 * One backend round, shared by the prompt path and the goal-loop driver
 * (ADR-0022): listener + differ baseline, subscribe with -32004 eviction
 * recovery, send-busy retry, drain gate after a recent cancel, the
 * event-driven turn loop with transient-failure retry, and the finally
 * cleanup (pendingTurns deregistration, discovery/quota refresh, turnState).
 * Every line here encodes an observed production failure — never reimplement
 * a second send/subscribe/retry path.
 */
export declare function runOneTurn(server: ZcodeAcpServer, opts: RunOneTurnOptions): Promise<acp.PromptResponse>;
/**
 * `session/set_config_option` → dispatch model/mode/thought and emit the
 * resulting config_option_update (+ current_mode_update for mode).
 */
export declare function setConfigOptionHandler(server: ZcodeAcpServer, params: acp.SetSessionConfigOptionRequest, cx: acp.AgentContext): Promise<acp.SetSessionConfigOptionResponse>;
/**
 * `session/cancel` → stop the in-flight turn immediately. Mirrors the ZCode
 * App's stop button, which sends a stop command directly (there is no
 * "cancel" concept on the client — only stop).
 *
 * We fire `session/stop` here instead of deferring it to the turn loop. The
 * loop is blocked for seconds at a time behind awaits (handleServerRequests
 * waiting on a permission popup; dispatchEvent running per-event; the
 * tool-result path awaiting dispatchEditDiff/dispatchPlanIfChanged backend
 * calls with up to 8s timeouts). A deferred stop only fires once the loop
 * finishes whatever await it is stuck in, so the user's press of stop can lag
 * by the full remaining await window — the turn visibly "keeps running".
 * `session/stop` is fire-and-forget and fully idempotent (the backend no-ops
 * on a session with no active turn, and on a turn already aborted), so firing
 * it eagerly is safe; the loop's `stopSent` guard prevents a second send.
 *
 * `turn.cancelled` is still set so the turn loop returns at once (the backend
 * ignores session/stop — verified 0.16.5, the model stream runs to its natural
 * end — so waiting for a terminal event would hang the stop for the whole
 * remaining generation). The loop's return resolves session/prompt with
 * stopReason "cancelled" immediately.
 */
export declare function cancel(server: ZcodeAcpServer, params: acp.CancelNotification): Promise<void>;
/**
 * Whether a thrown error is the RequestError form of a backend-lost turn
 * failure (as produced by turnFailureRequestError). The goal-loop uses this
 * to choose between respawn-and-continue and a hard pause.
 */
export declare function isBackendLostRequestError(e: unknown): boolean;
/** Dependencies of drainBackendAfterCancel, injectable for tests. */
interface DrainDeps {
    acpSid: string;
    zcodeSid: string;
    turn: PendingTurn;
    listener: EventStreamListener;
    monitor: TurnMonitor;
    differ: ProjectionDiffer;
    cx: acp.AgentContext;
    /** Test hook: override the close-escalation grace (default 5s). */
    escalateAfterMs?: number;
}
/**
 * Drain gate: a recent cancel/preempt means the backend side needs settling
 * before the next send. Primary path: stopBackendTurn's v4/command stop kills
 * the generation at once, so the first probe here already sees idle.
 * Fallbacks: on a backend that honours session/stop we poll the projection
 * until idle (a send that lands mid-generation is accepted as a steer whose
 * input the backend silently DROPS when the old turn finishes); if the
 * generation is STILL running after a grace period — both stops ignored —
 * escalate to session/close, which tears down the runtime and kills it
 * outright (the probe then fails into the reload branch). A visible chunk
 * tells the user why the send waits. Bounded: on timeout send anyway — the
 * steer-drop risk returns (the turn.steerQueued guard in runEventTurn reports
 * it), but blocking the prompt forever is worse.
 *
 * Two post-drain repairs, both mirroring established patterns (prompt's
 * eviction recovery / transient-retry re-baseline):
 * - resubscribe: session/close killed the runtime this prompt subscribed to;
 *   the reload revives the session but not the event push, so re-arm it —
 *   without resubscribe the next turn runs deaf (no events at all, and stall
 *   recovery can't engage because it needs turn.started).
 * - re-baseline: the abandoned turn committed messages to the session history
 *   while we waited (and close persisted its partial output); without markSeen
 *   the completion diff replays that residue as this turn's output.
 *
 * Returns "cancelled" when the turn was flagged cancelled during the drain
 * (stop pair fired; caller resolves session/prompt at once).
 */
export declare function drainBackendAfterCancel(server: ZcodeAcpServer, deps: DrainDeps): Promise<"cancelled" | "drained">;
/**
 * Serialize a per-session critical section. Each section awaits the previous
 * one's promise before running, so concurrent prompts for the same session
 * execute register+preempt strictly one after another.
 *
 * Used by prompt() to wrap "register self in pendingTurns + preempt others":
 * the registration must land before the section releases, so the next prompt
 * entering its section sees this turn in its preempt scan. Without this lock,
 * two near-simultaneous prompts could both scan before either registers.
 *
 * The body is async only to satisfy the lock chain (registration is
 * synchronous; preempt no longer waits). The turn loop itself runs OUTSIDE
 * this lock — only registration + preempt are serialized.
 */
export declare function withPreemptLock(server: ZcodeAcpServer, zcodeSid: string, body: () => Promise<void>): Promise<void>;
/**
 * Cancel any other in-flight turn for this zcodeSid: fire `session/stop` and
 * signal the old turn to stop retrying, then return immediately.
 *
 * We do NOT wait for the old turn's runEventTurn to exit. Previously this spun
 * on `pendingTurns` deletion (the old turn's finally), but that signal only
 * proves "the old turn's loop returned" — NOT "the backend is ready for a new
 * turn". Waiting on it blocked the new prompt in a long loading state while
 * the backend's stop-recovery window elapsed, and it still didn't prevent the
 * next send from racing the backend. The backend's prompt lock is the only
 * authoritative readiness signal: the new prompt's `session/send` retries
 * until the lock releases, so there is nothing useful to wait for here.
 *
 * The old turn's runEventTurn ends on its own once it sees a terminal event
 * from the backend (turn.completed/turn.failed after stop). Until then it
 * keeps dispatching whatever the backend sends for this session — which is
 * correct, because within a single session the backend is the single source
 * of truth and its events should reach the client.
 *
 * Exported for unit tests (multi-turn pendingTurns scenarios).
 */
export declare function preemptInFlightTurn(server: ZcodeAcpServer, zcodeSid: string, selfRequestId: number | string): boolean;
/** Concatenate text from ACP ContentBlock[] into a prompt string.
 *  Exported for unit testing (the resource_link path is easy to break). */
export declare function extractPromptText(blocks: acp.ContentBlock[] | undefined): string;
/**
 * ACP `ContentBlock::Image` → zcode `session/send` attachment.
 *
 * zcode's per-attachment normalizer accepts either a `localPath` (absolute FS
 * path, preferred) or `dataBase64` + `mimeType` (raw base64, no data: prefix).
 * ACP `ImageContent` carries `data` (base64) and an optional `uri`; when the
 * uri is a file:// pointer we send localPath so the backend streams from disk
 * instead of re-encoding.
 */
export interface ImageAttachment {
    kind: "image";
    filename: string;
    mimeType: string;
    sizeBytes?: number;
    dataBase64?: string;
    localPath?: string;
}
/**
 * Extract image attachments from ACP ContentBlock[]. Non-image blocks are
 * ignored (text/resource_link/resource stay owned by `extractPromptText`).
 * Exported for unit testing.
 */
export declare function extractAttachments(blocks: acp.ContentBlock[] | undefined): ImageAttachment[];
/**
 * Reload a session into the backend subprocess via `session/resume` — the
 * recovery path after the backend evicted the resident runtime (idle timeout
 * / LRU). Same param shape as session/load·resume (workspace from the
 * recorded session cwd, default-model overlay only if a faithful resume
 * fails). Marks the session backend-loaded on success.
 */
export declare function reloadBackendSession(server: ZcodeAcpServer, acpSid: string, zcodeSid: string): Promise<void>;
/**
 * Cache the FULL model-availability list from a session snapshot's
 * `settings.model.available`.
 *
 * `session/create` AND `session/resume`/`fork` all return the complete list
 * with authoritative `reasoning.defaultLevel` — only `session/read` is
 * hardcoded to `modelAvailability:"current"` (source: server-operations.ts:1828-1831
 * vs the option-less snapshot resume/fork get at :1518-1521/:2323). A resume is
 * therefore a free refresh for models added after create (a personal
 * `provider_config.json` rule, a host account push) that the create snapshot
 * missed: model switches resolve a target's default reasoning level from this
 * cache, and the object form of `session/setModel` hard-fails a level-bearing
 * model without one ("Reasoning level is required").
 *
 * Best-effort: an empty or missing list leaves any previous cache intact.
 */
export declare function cacheModelAvailability(server: ZcodeAcpServer, zcodeSid: string, result: unknown): void;
/**
 * fetchMessages + bounded read-back settle, for paths that JUST performed a
 * resume. The backend's `session/messages` reflects only what it has hydrated
 * so far — a query landing mid-restore returns a PREFIX, and replaying that
 * prefix makes the conversation "end in the middle" on first entry (re-entry
 * is fine once hydration finished; big sessions hydrate slowly, hence
 * "often but not always"). Poll until the count has stopped growing for TWO
 * consecutive reads (a single equal pair can be a >gap plateau inside a slow
 * hydration), capped; on the cap the largest snapshot seen wins. A capped
 * exit records the session in server.hydrationUnsettled so later replay
 * reads re-settle (fetchMessagesForReplay); a stable exit clears it.
 *
 * Re-settles (a marker left by a capped settle) fast-path on the WATERMARK:
 * one non-growing read that itself reaches the largest length any settle has
 * ever observed counts as caught-up. Demanding the full two-read plateau again
 * meant slow-reading sessions NEVER cleared the marker — every load re-paid
 * a capped settle (observed 2026-09-20: 22–56s loads on a 7413-message
 * session). The confirming READ (not this flight's running max) must reach
 * the live watermark, so a read that dips below what any settle has seen
 * falls back to the plateau rule; watermark writes are monotonic, so a
 * concurrent settle's higher observation is never traded down. Residual,
 * accepted: a hydration stalling at/above the watermark across one read+gap
 * still exits early with a prefix — bounded, and the next plain read
 * self-heals. Watermarks reset on backend respawn (ensureBackend).
 */
export declare function fetchMessagesSettled(server: ZcodeAcpServer, zcodeSid: string): Promise<ZcodeMessage[]>;
/**
 * Cold-start send rejection worth retrying: right after a sandbox-allow
 * respawn, the reloaded session's recorded model briefly reads as
 * unavailable while the fresh backend finishes loading its model list — the
 * same send succeeds seconds later (verified in production: the automatic
 * continuation was rejected with "历史任务使用的模型已不可用", a manual
 * resend a minute later went through). Matches the backend's Chinese wording
 * plus a generic English form.
 */
export declare function isTransientSendError(message: string): boolean;
/**
 * A failure proving the backend no longer STORES the session at all — as
 * opposed to "Session is not active", which only means the resident runtime
 * was evicted and a session/resume reloads it. Matches both spellings the
 * builds in the wild produce ("Session not found: <sid>", "Session ID 不存在"),
 * mirroring translateResumeFailure's match.
 */
export declare function isSessionGoneError(e: unknown): boolean;
/**
 * Map the backend's merged per-turn usage (`EventTranslator.turnUsage`) onto
 * the ACP `PromptResponse.usage` shape (UNSTABLE in agent-client-protocol;
 * per-turn semantics per its "Token usage for this turn" description). The
 * three required counters are always present in the backend object (its
 * reducer 0-fills them); the optional ones pass through as null when
 * unreported. Field renames: reasoningTokens→thoughtTokens,
 * cacheRead/cacheWriteTokens→cachedRead/cachedWriteTokens.
 *
 * The backend's inputTokens is OpenAI-style: it ALREADY contains the cache
 * read+write tokens (verified live 2026-09-18: totalTokens == inputTokens +
 * outputTokens on a real turn.completed frame). ACP's de-facto convention —
 * claude-agent-acp passthrough and DeepSeek's dsh-token-meter four-bucket
 * model alike — reports inputTokens EXCLUDING cache, and clients (martty's
 * stats-view, Zed) compute cache hit rate as cachedRead / (input + cachedRead
 * + cachedWrite). Forwarding the inclusive number double-counts the cache in
 * their denominator, so normalize: inputTokens here is cache-exclusive,
 * clamped at 0. totalTokens passes through unchanged — the backend's
 * input+output sum IS the convention's four-bucket total, arithmetically.
 */
export declare function toAcpTurnUsage(u: Record<string, unknown> | null): acp.Usage | undefined;
/**
 * Build the ACP `session/prompt` result for a concluded turn, attaching the
 * turn's usage when the backend reported one (absent otherwise — no synthetic
 * zeros). Spec fields carry the standard counters; backend extras (source,
 * modelRequestCount, web request counts) ride in `_meta.zcode.usage` per the
 * bridge's extension policy, plus `rawInputTokens` whenever normalization
 * changed it (reconciliation/diagnostics).
 */
export declare function turnResult(translator: EventTranslator, stopReason: acp.StopReason): acp.PromptResponse;
/**
 * Event-driven turn loop: translate zcode events via EventTranslator and
 * dispatch each internal event to the ACP client. No-progress timeout is 120s
 * (refreshed by any event). Cancel is honoured on each iteration.
 *
 * Server→client requests (interaction/*) are drained each iteration; full
 * handling (requestPermission / ExitPlanMode / AskUserQuestion) lands in
 * Commit 6 — for now they're polled to keep the inbox clear.
 */
export declare function runEventTurn(server: ZcodeAcpServer, listener: EventStreamListener, monitor: TurnMonitor, differ: ProjectionDiffer, cx: acp.AgentContext, acpSid: string, chunkMsgId: string, turn: PendingTurn, gateArmed: boolean): Promise<acp.PromptResponse>;
/**
 * Turn-attribution gate decision (pure, exported for tests): whether an event
 * observed before this turn's own `turn.started` should be dropped as leftover
 * residue of a prior turn.
 *
 * Residue only exists when this send preempted/cancelled another prompt (its
 * finalising events land in the new listener's queue). Without preemption the
 * queue can only carry events of a backend-owned turn already active at send
 * time — e.g. the main-branch turn auto-resumed after a compaction — which
 * this send was steered into and which emits no new `turn.started`; dropping
 * those events would silently swallow the whole turn's output in the UI.
 */
export declare function shouldDropEventForTurnAttribution(ev: {
    type: string;
}, turnStarted: boolean, preempted: boolean): boolean;
/**
 * Flatten the todos payload from `session/read`. Prefers the top-level `todos`;
 * when empty, flattens `todoGroups` — the real backend dump carries todos as a
 * list of groups (each with `entries` or `todos`), not a single object. Mirrors
 * Python `_build_snapshot`. Exported for unit testing.
 */
export declare function flattenTodos(todos: unknown[] | undefined, todoGroups: Array<{
    entries?: unknown[];
    todos?: unknown[];
}> | undefined): unknown[];
/**
 * Re-read the authoritative session mode and, if it changed since the last
 * value advertised to the client, emit `current_mode_update` +
 * `config_option_update`. Covers in-turn mode switches performed by internal
 * tools (EnterPlanMode/ExitPlanMode) that bypass `session/setMode` and thus
 * emit no notification of their own. Best-effort: failures are logged and
 * swallowed so they never break the turn-completion path.
 */
export declare function emitModeIfChanged(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string): Promise<void>;
export declare function dispatchPlanIfChanged(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string, differ: ProjectionDiffer, chunkMsgId: string, recheck?: boolean): Promise<void>;
export {};
//# sourceMappingURL=session.d.ts.map