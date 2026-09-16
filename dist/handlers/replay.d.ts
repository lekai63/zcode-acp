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
/** Fetch session/messages from zcode (the bridge's only history source). */
export declare function fetchMessages(server: ZcodeAcpServer, zcodeSid: string): Promise<ZcodeMessage[]>;
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