/**
 * Remote session rename endpoint, served on the bridge's loopback HTTP server
 * and byte-proxied by the hub at
 * POST /api/instances/{id}/sessions/{sessionId}/rename (JSON body: {title}).
 *
 * A rename is the ONLY way a session title changes after its one-shot
 * auto-title (set once at the first prompt). The bridge applies it in-memory
 * (sessionTitles + discovery summary), persists it to the App's tasks-index
 * with title_overridden=1 — the same pin the App's own rename flow sets, so
 * no later automatic write can touch it — and broadcasts session_info_update
 * so attached editors and phones update live.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZcodeAcpServer } from "../server.js";
/**
 * Build the /sessions/{id}/rename request handler for the loopback endpoint.
 * Async failures degrade to a status code, never into the event loop.
 */
export declare function createSessionRenameHandler(server: ZcodeAcpServer): (req: IncomingMessage, res: ServerResponse, sessionId: string) => void;
//# sourceMappingURL=session-rename-endpoint.d.ts.map