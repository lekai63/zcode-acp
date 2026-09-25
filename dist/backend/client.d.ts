/**
 * ZCode subprocess client: spawn, read-loop multiplexer, async request/response.
 *
 * The ZCode app-server is launched as a subprocess (`zcode app-server --stdio`)
 * speaking line-delimited JSON over stdio. A single async read loop demultiplexes
 * inbound messages into three channels:
 *   - responses (id, no method) → resolve the matching pending request promise
 *   - server→client requests (id + method, id not pending) → server-request queue
 *   - notifications (no id):
 *       - `session/event` → routed to the registered session listener
 *       - anything else   → general notification queue
 *
 * Process-group isolation: the subprocess is its own process-group leader
 * (`detached: true`) so `close()` can kill the whole tree (zcode + its model
 * workers) with `process.kill(-pid)` and leave no orphans.
 */
import { type ChildProcess } from "node:child_process";
import type { ZcodeEvent, ZcodeInteractionPermissionParams, ZcodeInteractionUserInputParams, ZcodeResponse } from "./types.js";
/** A server→client request that we must reply to. */
export interface ServerRequest {
    id: number | string;
    method: string;
    params: ZcodeInteractionPermissionParams | ZcodeInteractionUserInputParams | Record<string, unknown>;
}
/** Listener for `session/event` pushes on a given session. */
export interface EventListener {
    handleEvent(event: ZcodeEvent): void;
}
export declare class ZcodeBackend {
    readonly proc: ChildProcess;
    private readonly pending;
    private readonly serverRequests;
    private readonly listeners;
    private readerDead;
    /** Monotonic id for fire-and-forget sends (send()). Uses a high range to
     *  avoid collisions with the server's request ids (low range). */
    private sendIdCounter;
    /** Watchdog process that kills the zcode group if this bridge dies (SIGKILL). */
    private watchdog;
    /**
     * Arrival-time responder for `interaction/requestProviderRuntimeHeaders`.
     * The backend asks before EVERY model request on a zhipu-account provider,
     * and a request that lands while no turn loop is polling the server-request
     * queue (compact's internal turn, session/goal set, any backend-owned
     * generation) dies at the backend's 180s cap as "Captcha verification
     * request timed out" — auto-compact silently failed that way (observed
     * 2026-09-19). Wired by ZcodeAcpServer.ensureBackend to the coding-plan key
     * answer; returning false falls back to queueing (turn-loop handling).
     */
    providerRuntimeHeadersResponder?: (id: number, params: Record<string, unknown>) => boolean;
    /**
     * Arrival-time hook for compact terminal states. `session/compact` runs its
     * internal turn in the background and NEVER reports failure on the RPC —
     * the outcome only surfaces as a `state.updated` notification whose reason
     * is one of `session_compacted` / `session_compact_cancelled` /
     * `session_compact_failed` (source: server-operations.ts
     * `runCompactTurnInBackground` → `afterStateMutation`). Wired by
     * ZcodeAcpServer.ensureBackend to record per-session outcomes so compact()
     * can report real failure instead of assuming success from the RPC ack.
     */
    onCompactOutcome?: (sessionId: string, reason: string) => void;
    constructor(argv: string[], env: NodeJS.ProcessEnv);
    /**
     * Spawn a tiny detached watchdog that kills the zcode process group if this
     * bridge process disappears.
     *
     * The detached/kill(-pid) cleanup in `close()` only runs when the bridge
     * exits cleanly enough for the signal handlers to fire (SIGTERM/SIGINT/etc).
     * If the bridge is SIGKILLed (Zed force-kill on reconnect, crash, OOM), the
     * handler never runs and the zcode subprocess group is orphaned. The
     * watchdog closes that gap: it polls the bridge pid every 2s and, once the
     * bridge is gone, sends SIGKILL to the zcode process group, then exits.
     *
     * The watchdog is its own process-group leader (detached) and `unref`'d, so
     * it never holds the event loop open and is not part of the zcode group it
     * kills. It self-terminates as soon as the zcode process exits, so a normal
     * shutdown leaves no lingering watchdog.
     */
    private startWatchdog;
    private startReader;
    private route;
    /** Deliver a ZcodeEvent to every listener registered for its session. */
    private dispatchEvent;
    private resolvePending;
    private markReaderDead;
    registerEventListener(zcodeSid: string, listener: EventListener): void;
    unregisterEventListener(zcodeSid: string, listener: EventListener): void;
    /** Non-blocking drain of pending server→client requests. */
    pollServerRequests(): ServerRequest[];
    /**
     * Re-queue server→client requests that belong to a different session (prepended
     * to preserve arrival order). Used by `handleServerRequests` to put back
     * requests it popped but doesn't own.
     */
    requeueServerRequests(reqs: ServerRequest[]): void;
    /** Reply to a zcode server→client request with a result (id + result). */
    sendReply(id: number | string, result: unknown): void;
    /** Reply to a zcode server→client request with an error. */
    sendError(id: number | string, code: number, message: string): void;
    /** Fire-and-forget notification to ZCode (no id, no response). */
    notify(method: string, params?: Record<string, unknown>): void;
    /**
     * Send a message with an id but WITHOUT registering a pending response
     * (fire-and-forget). Mirrors Python's `_backend.send({"id": ..., ...})` for
     * `session/stop`: some backends route by id presence, so carrying an id is
     * more robust than a bare notify. If the backend replies, the reader's
     * `resolvePending` finds no pending entry and safely discards it.
     */
    send(method: string, params?: Record<string, unknown>): void;
    /**
     * Synchronous request/response: register a pending promise, send, await.
     * Other notifications arriving during the wait are routed async by the
     * reader loop (they don't get swallowed).
     *
     * Returns `{error}` on dead backend, broken pipe, or timeout — never throws.
     */
    request(id: number, method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<ZcodeResponse>;
    /**
     * Kill the whole zcode process group and wait for it to die.
     *
     * SIGTERM → wait up to 3s → SIGKILL if still alive. Mirrors the Python
     * `os.killpg` + `proc.wait(3)` + SIGKILL escalation. Note `proc.killed` is
     * NOT set by `process.kill(-pid)` (group signal), so we track liveness via
     * `exitCode === null` instead. Async so the caller can `await` a full reap
     * before the parent exits (an unref'd timer could be skipped on fast exit,
     * leaving orphans).
     */
    close(): Promise<void>;
    /** Terminate the watchdog process if it is still running. */
    private killWatchdog;
    get isDead(): boolean;
}
//# sourceMappingURL=client.d.ts.map