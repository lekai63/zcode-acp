/**
 * Dynamic-workflow run progress poller.
 *
 * The backend strips per-actor/per-node workflow progress from the v3 stream
 * (session-mapper filters `dynamic_workflow_run_progress`; the authoritative
 * projection lives behind the v4 conversation API), so an ACP client would see
 * the CreateWorkflow card sit silent for the whole run. This module re-attaches
 * progress by polling the v4 journal query and folding concise progress lines
 * into the card as `tool_call_update` notifications.
 *
 *   v4/conversation/workflowRunEvents {sessionId, runId, afterSequence, limit}
 *     → {events: [{sequence, type, payload, truncated?}], hasMore}
 *
 * The cursor is the journal sequence (never invalidated), so the poll is
 * stateless and safe to re-issue. Runs are armed by the background-task
 * listener (taskKind "workflow", taskId ≡ runId) — the SINGLE arm point,
 * covering model-launched runs (visible CreateWorkflow card) and
 * settings-launched ones (synthetic tool call, no live card — the fallback
 * [background] card is the fold target). Emissions are append DELTAS (only
 * the lines added since the previous emission) fanned out per-alias via
 * `server.notifyByZcodeSid`, covering both turn-internal and turn-external
 * runs.
 *
 * Everything here is best-effort: request() resolves `{error}` instead of
 * throwing, and every failure path only logs — never into the event loop.
 */
import type { ZcodeAcpServer } from "../server.js";
/** Poll cadence (setTimeout chain, timers unref'd). Injectable for tests. */
export declare const WORKFLOW_POLL_INTERVAL_MS = 3000;
/** One v4 journal event (transport.ts:599-646). */
interface WorkflowRunEvent {
    sequence: number;
    type: string;
    payload?: Record<string, unknown>;
    truncated?: boolean;
}
/**
 * Reduce one journal event to a concise progress line, or null when the event
 * is chatty (log/report/usage updates) and must not reach the card. Payload
 * fields are read defensively — engine payload shapes are not part of the v4
 * wire contract we consume, and raw ids (actorSessionId) are never printed.
 */
export declare function workflowEventLine(ev: WorkflowRunEvent): string | null;
/**
 * Arm the progress poller for a workflow run. Single-flight per runId: a
 * re-arm (task status updates repeat the launch payload) is a no-op. The
 * first poll fires after one interval.
 */
export declare function armWorkflowRunPoller(server: ZcodeAcpServer, zcodeSid: string, opts: {
    runId: string;
    toolCallId: string;
    intervalMs?: number;
}): void;
/** Stop the poller for one run (background task reached a terminal status). */
export declare function stopWorkflowRunPoller(runId: string): void;
/** Stop every poller (bridge shutdown — mirrors background-task shutdown records). */
export declare function stopAllWorkflowRunPollers(): void;
/**
 * Stop every poller armed under one backend session (the session/close
 * cleanup path). Best-effort, never throws — a closed session's journal
 * answers can outlive the runtime, and polling it would only end at the hard
 * cap with a stray timeout notice for a conversation nobody can see anymore.
 */
export declare function stopPollersForSession(zcodeSid: string): void;
/** Test/observability hook: is a poller currently armed for this runId? */
export declare function workflowPollerActive(runId: string): boolean;
export {};
//# sourceMappingURL=poller.d.ts.map