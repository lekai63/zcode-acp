/**
 * Remote session close endpoint (ADR-0006), served on the bridge's loopback
 * HTTP server and byte-proxied by the hub at
 * POST /api/instances/{id}/sessions/{sessionId}/close.
 *
 * Closing RETIRES a session from remote discovery — it is not deletion. The
 * backend store, the editor's own conversation storage, and the App's
 * tasks-index are untouched; the backend's resident runtime for the session
 * is evicted (session/close) so the conversation stops without losing
 * history. Why it exists: the ACP protocol has no editor→agent "tab closed"
 * notification, so a conversation retired on the editor side stays
 * advertised by this bridge's in-memory summary forever.
 *
 * The "editor side still has it open" guard cannot be a precondition check
 * (unobservable); it is the hasActivity gate's natural re-arm instead: a
 * closed entry loses its summary, and `markSessionActive` (any prompt, any
 * load with history) recreates it — so a wrongly closed conversation
 * reappears the moment the editor touches it, while an editor-side-retired
 * one stays gone. A running turn is the one case we CAN observe and reject.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZcodeAcpServer } from "../server.js";
export interface ServeTerminateDecision {
    /** Terminate this bridge once the close response has flushed. */
    terminate: boolean;
    /** Foreground process-group id of the incubated TUI tree; absent = headless. */
    tuiPgid?: number;
}
/**
 * Should closing a session TERMINATE this bridge? Only for remote-incubated
 * instances (ZCODE_ACP_REMOTE_ORIGIN=serve, ADR-0016): their CLI was spawned
 * for exactly this conversation, so the last close ends it — the TUI window's
 * whole process tree (cli → martty → bridge) via one group signal, or a plain
 * self-exit for the headless serve bridge (pulling its idle exit forward).
 * Editor-origin bridges return null and keep the retire-only semantics.
 * Pure — exported for unit tests.
 */
export declare function serveTerminateDecision(advertisedCount: number, env?: {
    ZCODE_ACP_REMOTE_ORIGIN?: string;
    ZCODE_ACP_TUI_CLI_PID?: string;
}): ServeTerminateDecision | null;
/**
 * Pids to SIGTERM directly when tearing down an incubated TUI tree: the
 * incubated CLI (ZCODE_ACP_TUI_CLI_PID — tui.ts forwards its SIGTERM to the
 * martty child and exits clean) and this bridge's parent (the TUI host
 * driving this bridge's stdio). Deduped; pid 1 excluded. Pure — for tests.
 */
export declare function tuiTeardownPids(tuiPgid: number, ppid: number): number[];
/**
 * Build the /sessions/{id}/close request handler for the loopback endpoint.
 * Async failures degrade to a status code, never into the event loop.
 */
export declare function createSessionCloseHandler(server: ZcodeAcpServer): (req: IncomingMessage, res: ServerResponse, sessionId: string) => void;
//# sourceMappingURL=session-close-endpoint.d.ts.map