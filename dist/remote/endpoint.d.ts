/**
 * Loopback ACP endpoint + hub registration for remote access.
 *
 * When ZCODE_ACP_REMOTE is enabled, the bridge serves the SAME AgentApp that
 * handles the stdio editor connection on a loopback HTTP/WebSocket endpoint
 * (SDK AcpServer transport). Each remote connection gets its own JSON-RPC id
 * space; fan-out to all clients is handled by the broadcast registry, not
 * here. This endpoint is intentionally NOT exposed to the network — the hub
 * (`zcode-acp hub`) is the single public entry and proxies into it.
 *
 * The bridge also registers itself with the hub (spawning one if none is
 * listening) and re-registers every 10s as a heartbeat carrying fresh session
 * summaries. Everything here is best-effort: any failure warns and disables
 * the remote side without touching the stdio link.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
import { type SessionRunStatus } from "./status-endpoint.js";
import type { RemoteConfig } from "./config.js";
/** One heartbeat/discovery session entry (ADR-0005 adds `status`). */
interface AdvertisedSession {
    sessionId: string;
    title?: string;
    updatedAt: number;
    status: SessionRunStatus;
}
export interface RemoteEndpointHandle {
    /** Actual loopback port the endpoint bound (may differ from config). */
    port: number;
    /** Stop the endpoint and unregister from the hub (best-effort). */
    stop(): Promise<void>;
}
/**
 * Session summaries for the hub's discovery API. Two gates, in the user's
 * words: the conversation must be CURRENTLY RUNNING, and it must be
 * ACCESSIBLE through the bridge that lists it.
 *
 * - Running: membership comes only from this bridge's live registrations
 *   (`sessionSummaries` with `hasActivity`) — open editor tabs and remote
 *   attachments that ran a turn. The backend store also holds every retired
 *   conversation of the project (dozens of same-titled test runs included),
 *   so deriving membership from `session/list` floods the list with
 *   duplicates; the list only ENRICHES members with the store's authoritative
 *   title and a cross-bridge updatedAt (which also steers the hub's dedupe
 *   toward the instance actually driving the session).
 * - Accessible: every member is a registered acp→zcode mapping here, so a
 *   remote `session/load` resolves and resumes it on demand. Lazy
 *   placeholders without a backend session never ran a turn and stay
 *   invisible — except REMOTE-created ones (`remoteCreatedSessions`), which
 *   the phone must see in its active list right after creating them (for as
 *   long as the hosting CLI bridge lives).
 *
 * Advertised ids are the ACP session ids the EDITOR uses (placeholder ids,
 * stable across bridges via Zed's own storage and the durable alias store) —
 * NOT raw backend session ids. A remote client that attaches under the same
 * id as the editor tab shares the conversation's notification stream, so
 * turns driven from either side stream live to both; advertising backend ids
 * instead silently split the two views (Zed stopped seeing remote-driven
 * turns). Sessions known here only under a backend id (no placeholder) are
 * advertised under that backend id — still loadable via pass-through resume.
 * Bridges of the same project derive the same id for the same conversation,
 * which is what lets the hub dedupe across instances.
 *
 * A failed `session/list` degrades to summaries-only so a backend hiccup
 * never blanks the discovery list.
 */
export declare function collectSessions(server: ZcodeAcpServer): Promise<AdvertisedSession[]>;
/**
 * Start the loopback endpoint and hub registration. Never throws — failures
 * warn and leave the bridge running stdio-only.
 */
export declare function startRemoteEndpoint(server: ZcodeAcpServer, app: acp.AgentApp, config: RemoteConfig): Promise<RemoteEndpointHandle | null>;
export {};
//# sourceMappingURL=endpoint.d.ts.map