/**
 * Dynamic-workflow management plane — the backend-facing half (plan §7).
 *
 * The desktop manages saved workflows over its private v4 channel + GUI; ACP
 * has no resource-management family at all, so the Settings API is the ONLY
 * surface a remote App has. This module owns the wire translation:
 *
 * - `workflows/*` (session-less file ops) carry the bridge's primary project
 *   cwd as the workspace ref — the same derivation the hub discovery payload
 *   uses (collectSessions → server.projectCwd()).
 * - `v4/conversation/workflowRun*` queries are session-scoped: callers hand
 *   over an ACP session id, this module resolves the backend zcodeSid.
 * - start/resume go through `v4/command` with `request()` so the response IS
 *   the terminal CommandAck — the gateway awaits the side effect (script
 *   compile included), which is why those timeouts are the longest here.
 *
 * Every RPC goes through `backend.request`, which NEVER throws — it resolves
 * `{error}`. Errors surface as {@link WorkflowApiError} carrying the HTTP
 * status in `code` and a short machine-readable `reason` token, so the route
 * layer never has to re-classify.
 */
import { type WorkflowGate } from "../config/workflow-gate.js";
import type { ZcodeAcpServer } from "../server.js";
/** Workflow scope vocabulary (upstream workflows/* `scope`). */
export type WorkflowScope = "project" | "global";
/**
 * A workflow failure the route layer can map directly: `code` is the HTTP
 * status, `reason` a short token for clients ("session_busy",
 * "workflow_disabled", …), and `message` the human-readable detail (for
 * `compile_failed` it carries the backend's bounded diagnostics).
 */
export declare class WorkflowApiError extends Error {
    readonly code: number;
    readonly reason: string;
    constructor(code: number, reason: string, message?: string);
}
/**
 * Await the per-backend gate verdict and refuse when the feature is off.
 * The upstream v4 start/resume commands are NOT gated by the backend policy
 * (port presence is their only gate), so the bridge guards itself — a
 * headless backend would otherwise happily run workflows the remote config
 * disabled. A null gate means NO backend was ever spawned (an App-only flow
 * that never chatted): spawn one — ensureBackend starts the gate fetch — and
 * await the fresh verdict, so a cold bridge reports the real answer instead
 * of a false 403. An actual fetch failure still settles disabled
 * (fail-closed, like the gate itself).
 */
export declare function requireWorkflowEnabled(server: ZcodeAcpServer): Promise<WorkflowGate>;
/** `workflows/list` — entries + `invalid[]` + `dir` (present even when missing). */
export declare function listWorkflows(server: ZcodeAcpServer, scope?: WorkflowScope): Promise<Record<string, unknown>>;
/** `workflows/get` — script + meta for one saved workflow (directed scope). */
export declare function getWorkflow(server: ZcodeAcpServer, scope: WorkflowScope, name: string): Promise<Record<string, unknown>>;
/** `workflows/updateMeta` — read-modify-write of the frontmatter only. */
export declare function updateWorkflowMeta(server: ZcodeAcpServer, scope: WorkflowScope, name: string, meta: Record<string, unknown>): Promise<Record<string, unknown>>;
/** `workflows/delete` — unlink by scope root (name validated before path join). */
export declare function deleteWorkflow(server: ZcodeAcpServer, scope: WorkflowScope, name: string): Promise<Record<string, unknown>>;
/**
 * `workflows/move` — global→project ONLY (upstream design: promoting the
 * other way goes through SaveWorkflow in a project session). The scope path
 * segment exists for URL symmetry; the wire params carry no scope key
 * (upstream schema is `{workspace, name}`).
 */
export declare function moveWorkflow(server: ZcodeAcpServer, scope: WorkflowScope, name: string): Promise<Record<string, unknown>>;
/**
 * `workflows/runs` — journal-backed run history (survives restarts), scoped
 * by name when given. Limit clamps to the upstream 1..50 window.
 */
export declare function listRuns(server: ZcodeAcpServer, opts?: {
    scope?: WorkflowScope;
    name?: string;
    limit?: number;
}): Promise<Record<string, unknown>>;
/**
 * Resolve an ACP session id to the backend zcodeSid for READ-ONLY run
 * queries — without materializing anything. In-memory mappings first, then
 * the durable alias store's recorded zcodeSid; a lazy placeholder that was
 * never used has no backend session and no run history, so 404 is the honest
 * answer (and cheaper than a create).
 */
export declare function resolveWorkflowZcodeSid(server: ZcodeAcpServer, acpSid: string): string;
/** `v4/conversation/workflowRuns` — restart-discovery list incl. `resumable`. */
export declare function conversationRuns(server: ZcodeAcpServer, zcodeSid: string, limit?: number): Promise<Record<string, unknown>>;
/** `v4/conversation/workflowRunEvents` — journal events, cursor never expires. */
export declare function runEvents(server: ZcodeAcpServer, zcodeSid: string, runId: string, afterSequence?: number): Promise<Record<string, unknown>>;
/** `v4/conversation/workflowRunArtifacts` — artifact inventory with versions. */
export declare function runArtifacts(server: ZcodeAcpServer, zcodeSid: string, runId: string): Promise<Record<string, unknown>>;
/** `v4/conversation/workflowRunArtifactData` — board item pagination. */
export declare function runArtifactData(server: ZcodeAcpServer, zcodeSid: string, runId: string, artifactId: string, afterSequence?: number, limit?: number): Promise<Record<string, unknown>>;
/** `v4/conversation/workflowRunArtifactRead` — raw bytes in ≤512KiB chunks. */
export declare function runArtifactRead(server: ZcodeAcpServer, zcodeSid: string, runId: string, artifactId: string, version: number, offset: number, limit?: number): Promise<Record<string, unknown>>;
/** `v4/conversation/workflowRunWorkspace` — world-read/world-run rows. */
export declare function runWorkspace(server: ZcodeAcpServer, zcodeSid: string, runId: string): Promise<Record<string, unknown>>;
/** `v4/conversation/workflowRunNodeResult` — one node's bounded result. */
export declare function runNodeResult(server: ZcodeAcpServer, zcodeSid: string, runId: string, siteId: string, ordinal: number): Promise<Record<string, unknown>>;
export interface StartSavedWorkflowInput {
    scope?: WorkflowScope;
    name: string;
    args?: Record<string, unknown>;
    /** Existing session to launch in (must be idle). Absent → new session. */
    acpSessionId?: string;
}
export interface StartSavedWorkflowResult {
    acpSessionId: string;
    runId?: string;
    toolCallId?: string;
}
/**
 * Launch a saved workflow in a session the App can see and attach to.
 *
 * 1. Resolve the launch session: the caller's `acpSessionId`, or a NEWLY
 *    minted placeholder materialized through the bridge's own session
 *    registration path (`ensureRealSession`) — so the create carries the
 *    workflow flag, the alias mapping + durable record exist, and the App's
 *    session list / a later load-resume work like any editor-created session.
 * 2. `v4/command startSavedWorkflow` on that session; await the ack.
 * 3. `accepted` → `{acpSessionId, runId, toolCallId}` straight from the ack's
 *    result (the App's progress card joins on toolCallId).
 * 4. anything else — a non-accepted ack or a THROWN send (timeout, -32601,
 *    transport) — → close/discard a session WE created (never an
 *    APP-provided one) and rethrow with the reasonCode-mapped status.
 *
 * Consent semantics (upstream: "the hub click IS the consent"): calling this
 * API deliberately skips the backend's permission popup, matching the
 * desktop's launch button.
 */
export declare function startSavedWorkflow(server: ZcodeAcpServer, input: StartSavedWorkflowInput): Promise<StartSavedWorkflowResult>;
/**
 * Resume a stopped run (resumable set: cancelled ∪ failed-Interrupted — the
 * `resumable` flag on the run list is the caller's judgment source). Runs in
 * the caller-named session; success is a bare `accepted` ack (no result).
 */
export declare function resumeWorkflowRun(server: ZcodeAcpServer, input: {
    runId: string;
    acpSessionId: string;
    name?: string;
}): Promise<void>;
/** The prefilled prompt for the "create via conversation" entry point. */
export declare function workflowCreatePrompt(scope?: WorkflowScope): string;
//# sourceMappingURL=workflow.d.ts.map