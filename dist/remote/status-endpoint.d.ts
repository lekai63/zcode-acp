/**
 * Live session status endpoint, served on the bridge's loopback HTTP server
 * next to /acp and /fs, byte-proxied by the hub at
 * /api/instances/{id}/status (ADR-0005).
 *
 *   GET /status — every live session with its running state
 *
 * Assembled purely from in-memory state (session summaries + pending turns):
 * no backend RPC, so polling clients cost nothing. Title freshness stays the
 * heartbeat's job (collectSessions enriches via session/list); the running
 * state is the real-time part this endpoint exists for. Like /fs, the
 * endpoint is loopback-only and unauthenticated — the hub is the single
 * public entry and enforces the token.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZcodeAcpServer } from "../server.js";
export type SessionRunStatus = "running" | "idle";
export interface SessionStatusEntry {
    sessionId: string;
    title?: string;
    status: SessionRunStatus;
    updatedAt: number;
}
/**
 * zcode session ids with a turn still in flight. Matches the `turnActive`
 * derivation in `session/load`: a cancelled-but-finalising turn counts as
 * running — the conversation is still busy until its loop unwinds.
 */
export declare function runningZcodeSids(server: ZcodeAcpServer): Set<string>;
/**
 * Live sessions with their running state. Membership matches collectSessions:
 * `hasActivity` summaries that resolve to a backend session — lazy
 * placeholders that never ran a turn stay invisible.
 */
export declare function collectStatus(server: ZcodeAcpServer): {
    sessions: SessionStatusEntry[];
};
/**
 * Build the /status request handler for the loopback endpoint. Synchronous
 * assembly means the only failure paths are serialization — still answered
 * with a status code, never thrown into the event loop.
 */
export declare function createStatusHandler(server: ZcodeAcpServer): (req: IncomingMessage, res: ServerResponse) => void;
//# sourceMappingURL=status-endpoint.d.ts.map