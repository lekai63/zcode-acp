/**
 * Remote session history endpoint (ADR-0015, amended by ADR-0017), served on
 * the bridge's loopback HTTP server and wrapped by the hub at
 * GET /api/projects/sessions?workspacePath=…
 *
 * Discovery (the heartbeat payload) deliberately lists only RUNNING-scoped
 * sessions — deriving membership from the store would flood it with every
 * retired conversation. This endpoint is the deliberate counterpart: the
 * project's backend session store, closed conversations included, so a
 * remote client can pick one and resume it with `session/load` (pass-through
 * resume accepts raw backend ids). Conversations this bridge currently
 * holds — live, or with a turn in flight — are NOT listed: they are
 * discovery's subject, and offering them for resume would let a client load
 * one onto a second bridge (two backend processes, one conversation).
 * Sessions held by a DIFFERENT bridge of the same workspace are invisible
 * here — the two id spaces are unreconciled by design (ADR-0015 §5).
 *
 * Long-lived projects hold dozens of sessions, so the listing is PAGINATED:
 * newest first (updatedAt descending, sessionId descending as the tiebreak so
 * pages are stable), `limit` per page (default 20, max 200), and a composite
 * cursor for "load more": `?before=<ms>&beforeId=<sessionId>` names the last
 * row of the previous page, so one millisecond holding more rows than a page
 * never skips or repeats them. The response carries `nextCursor`
 * (`{before, beforeId}`, null on the last page). The backend `session/list`
 * has no native pagination — the full store arrives once, the live/running
 * exclusion applies BEFORE the window, and only then is it windowed here;
 * entries are tiny, so that round-trip is cheap.
 *
 * Returned rows keep the `live`/`running` fields for shape compatibility —
 * they are always false now (executing conversations never reach a page).
 * The workspace is never client-chosen: `listSessions` pins serve mode to
 * the process cwd (ADR-0014), and the editor case passes the bridge's own
 * project cwd.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZcodeAcpServer } from "../server.js";
/** Rows per page when the client sends no limit. */
export declare const DEFAULT_SESSION_LIMIT = 20;
/** Hard cap — a bigger ask is clamped, not refused. */
export declare const MAX_SESSION_LIMIT = 200;
/** Parsed pagination query; null = a malformed value the caller must 400. */
export interface SessionListQuery {
    limit: number;
    /** updatedAt (ms) of the cursor row: only older rows — or tied, see beforeId. */
    before?: number;
    /** sessionId of the cursor row: excludes it and already-shown tied rows. */
    beforeId?: string;
}
/** Parse ?limit=&before=&beforeId=; limit clamped into [1, MAX]. */
export declare function parseSessionListQuery(searchParams: URLSearchParams): SessionListQuery | null;
/**
 * Build the /sessions history request handler for the loopback endpoint.
 * Failures (backend down, spawn refused) degrade to a status code, never
 * into the event loop.
 */
export declare function createSessionListHandler(server: ZcodeAcpServer): (req: IncomingMessage, res: ServerResponse) => void;
//# sourceMappingURL=session-list-endpoint.d.ts.map