/**
 * Tail replay kernel — slicing, cursor pagination, and the `session/load`
 * replay/`session/load_earlier` handlers (Proposal 0001 / ADR-0003).
 *
 * session/load replays history as session/update notifications; for long
 * sessions that cost is O(full history) on every attach and reconnect. The
 * helpers here slice the fetched messages into turn-aligned batches and page
 * backwards with an opaque cursor. Batches are sent under the per-session
 * replay lock (`withReplayBatch` in io.ts) so a batch never interleaves with
 * live-turn updates for the same session; `replayMessages` is the one sender
 * that bypasses the per-message lock — it only runs inside a batch.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeMessage } from "../backend/types.js";
import type { ZcodeAcpServer } from "../server.js";
/** Upper bound for a requested tail/page size (values above clamp to this). */
export declare const MAX_REPLAY_LIMIT = 500;
/** Page size for `session/load_earlier` when the request omits `limit`. */
export declare const DEFAULT_EARLIER_LIMIT = 50;
/** Wire metadata describing one delivered batch (additive-only over time). */
export interface ReplayMeta {
    cursor: string;
    hasMore: boolean;
    replayedMessages: number;
    replayedTurns: number;
    totalMessages: number;
    totalTurns: number;
    /**
     * True when a turn for this session is still in flight on the bridge.
     * Re-attaching clients (mobile reconnect, second editor) restore their
     * "running" UI from this; they did not send the prompt, so only this flag
     * and the `$/zcode/turnState` notifications tell them a turn is active.
     */
    turnActive?: boolean;
}
export interface ReplaySlice {
    batch: ZcodeMessage[];
    meta: ReplayMeta;
}
/** `session/load_earlier` params (top-level — our parser, not an ACP spec method). */
export interface LoadEarlierParams {
    sessionId: string;
    before?: string;
    limit?: number;
}
/**
 * Slice the last `limit` messages, aligned back to the start of the turn
 * containing the oldest one — never a mid-turn cut. `limit: 0` attaches with
 * metadata only (cursor anchors at the end of history).
 */
export declare function sliceTail(messages: ZcodeMessage[], limit: number): ReplaySlice;
/** Full-history slice (no `_meta.zcode.limit` on session/load). */
export declare function fullSlice(messages: ZcodeMessage[]): ReplaySlice;
/**
 * Slice up to `limit` messages strictly older than the `before` cursor.
 * The cursor points into a prefix of history, so turns appended after it was
 * minted keep it valid; only a history that shrank (compaction/truncation)
 * throws `cursor expired` — clients map that to a full re-`session/load`.
 */
export declare function sliceBefore(messages: ZcodeMessage[], before: string, limit: number): ReplaySlice;
/**
 * Read the tail limit from `session/load`'s `_meta.zcode.limit`. The SDK's
 * zod params schema strips unknown top-level keys, so bridge extensions ride
 * in `_meta` (ADR-0003). Returns null when absent/non-finite = full replay.
 */
export declare function readTailLimit(params: acp.LoadSessionRequest): number | null;
/** Tuning knobs for fetchMessages; unset means the hydration defaults. */
export interface FetchMessagesOptions {
    /** Per-read RPC timeout. */
    timeoutMs?: number;
    /** Retry one failed read before degrading to `[]`. */
    retry?: boolean;
    /**
     * Native forward cursor (session/messages `afterMessageId`): the backend
     * returns only the messages AFTER this id. When the id is no longer in the
     * store (a rewind discarded its branch) the backend answers with the FULL
     * list — callers that cannot tolerate that must also pass `limit`.
     */
    afterMessageId?: string | null;
    /**
     * Native tail cap (session/messages `limit`): only the last N of the
     * (post-cursor) messages. Also bounds the not-found-cursor fallback above.
     */
    limit?: number;
}
/**
 * Turn-internal reads: short timeout, no retry. fetchMessages' generous
 * default exists for slow hydration reads on huge sessions; a turn-loop
 * caller (per-tool-result diff fetch, reply fallback) inheriting it would
 * stall the live stream for up to ~90s on a hung read. These callers
 * degrade gracefully instead — a missed diff is reconciled at turn
 * completion, a missed reply falls through to other recovery paths.
 */
export declare const TURN_READ: FetchMessagesOptions;
/**
 * Peek-read caps for turn-internal lookups whose target is always the
 * NEWEST message (the just-completed edit's tool part, the just-finished
 * reply). The anchor scopes the read; the cap only bounds the
 * cursor-not-found fallback, which answers with the whole store.
 */
export declare const EDIT_DIFF_READ_LIMIT = 60;
export declare const REPLY_READ_LIMIT = 60;
/**
 * Tail window for the goal loop's cursor-less reads (verdict / ticket
 * parsing). A turn's reply is its newest message, so the scan that walks
 * backward from the end finds it inside this window; the cap only keeps a
 * long session's per-round reads from transferring the whole history.
 */
export declare const GOAL_TAIL_READ_LIMIT = 200;
/**
 * Fetch session/messages from zcode (the bridge's only history source).
 *
 * The default RPC timeout is generous (45s): huge sessions' reads are slow by
 * nature (observed 2.4–6.3s on a 7413-message session, slower on a cold
 * backend) and an 8s cap turned them into failures. A failed read is NOT an
 * empty store — it retries once and only then degrades to `[]` (callers treat
 * empty as "nothing to replay"). Turn-internal callers pass TURN_READ to keep
 * the pre-0.44.2 bounded behavior.
 *
 * `afterMessageId`/`limit` map to the backend's native pagination (schema:
 * zcode-protocol index.ts:1658-1665; the handler slices after-id then
 * tail-limits in memory, server-operations.ts:1865-1876). The backend still
 * reads the whole store — these options shrink the bridge-side payload and
 * per-message work, not the backend's sqlite scan.
 */
export declare function fetchMessages(server: ZcodeAcpServer, zcodeSid: string, opts?: FetchMessagesOptions): Promise<ZcodeMessage[]>;
/**
 * Fetch only what arrived after the differ's history anchor — the residue of
 * an abandoned turn, or the messages a retry must re-baseline. A null anchor
 * (fresh differ) degrades to a full read, which is the pre-pagination shape.
 */
export declare function fetchMessagesSinceAnchor(server: ZcodeAcpServer, zcodeSid: string, anchor: string | null, opts?: FetchMessagesOptions): Promise<ZcodeMessage[]>;
/**
 * Replay condensation options. `toolTurnWindow` keeps tool records (real
 * tool_call parts AND the harness's rewritten tool-transcript pseudo-user
 * text) only for the most recent N turns of the batch — older turns replay
 * conversation text only. Built for the TUI resume tail: a multi-turn
 * session holds hundreds of tool rows, and even folded they scroll the chat
 * out of the terminal window. Editors pass nothing and keep full fidelity.
 */
export interface ReplayOptions {
    toolTurnWindow?: number;
    /**
     * Mark every update in this batch `_meta.zcode.earlierPage: true`. Set ONLY
     * by load_earlier: a remote client collecting in-flight session/updates
     * into an "older page" buffer cannot tell page replays from live-turn
     * updates client-side, so the page rides a protocol-level marker (merged
     * shallowly over any existing `_meta`); tail replays stay unmarked.
     */
    earlierPage?: boolean;
}
/**
 * Replay messages as session/update notifications, oldest → newest.
 *
 * MUST run inside `withReplayBatch` for the session: this is the one sender
 * that bypasses the per-message lock in sendSessionUpdate (the batch already
 * holds it), which is what makes the batch atomic against live dispatch.
 */
export declare function replayMessages(cx: acp.AgentContext, acpSid: string, messages: ZcodeMessage[], opts?: ReplayOptions): Promise<number>;
/**
 * `session/load_earlier` — deliver one page of history strictly older than
 * the `before` cursor, oldest → newest (clients prepend). Requires the
 * session to already be attached in this bridge; pagination never triggers
 * an implicit backend resume.
 */
export declare function loadEarlier(server: ZcodeAcpServer, params: LoadEarlierParams, cx: acp.AgentContext): Promise<{
    replayMeta: ReplayMeta;
}>;
//# sourceMappingURL=replay.d.ts.map