/**
 * Read-only session file endpoint (ADR-0004), served on the bridge's loopback
 * HTTP server next to /acp and byte-proxied by the hub at
 * /api/instances/{id}/fs/*. Two routes:
 *
 *   GET /fs/list?sessionId=&path=<relative-to-root>   — one directory level
 *   GET /fs/file?sessionId=&path=                      — file bytes
 *       [&offset=&length=] byte range  |  [&line=&limit=] text lines
 *
 * Every path is resolved against the session's root cwd (the Session Root)
 * and must stay inside it after realpath — `..` segments and symlinks that
 * escape the root are rejected. The endpoint is loopback-only and carries no
 * auth of its own, exactly like the ACP WebSocket beside it; the hub is the
 * only public entry and enforces the token.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZcodeAcpServer } from "../server.js";
/**
 * Build the /fs request handler for the loopback endpoint. Never throws —
 * every failure path answers with a status code.
 */
export declare function createFileHandler(server: ZcodeAcpServer): (req: IncomingMessage, res: ServerResponse) => void;
//# sourceMappingURL=file-endpoint.d.ts.map