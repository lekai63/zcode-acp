/**
 * Native guide-steer: `_zcode/guide` hands a mid-turn message to the running
 * backend turn instead of preempting it with a second `session/prompt`.
 *
 * ZCode's own "guide" (Desktop's follow-up mode) is the v4 `sendText` command
 * with `requestedDelivery: "guide"` (ZCode source: bootstrap
 * zcode-protocol-v4/commands/handlers/session-flow.ts → core
 * runtime/methods/prompt-admission.ts). On a steerable turn the input is
 * queued on that turn (`turn.steerQueued`) and injected as a user message at
 * the next model-step boundary — after a tool batch, or after a text-only
 * step, which then keeps the turn going (`turn.steerDrained`). When the turn
 * cannot take it any more (stopped by a tool, not steerable, interrupted) it
 * lands in the session queue instead; a backend that was already idle starts
 * it as its own turn (ack delivery `startNow`).
 *
 * The ACP prompt that owns the running turn stays open until every guide was
 * consumed: runOneTurn chains a follow-up round (awaitGuideFollowUp) when its
 * turn ended with a guide still queued. One bridge-specific gap: ZCode drains
 * its queue only after turns started through v4, never after a legacy
 * `session/send` turn (server-operations.ts runPromptTurnInBackground ends in
 * afterStateMutation, which has no auto-drain), so the follow-up resumes the
 * queue itself with `setAutoDrain` — the native, idle-only promotion.
 *
 * Text only: V4 attachments are refs and a guide with attachments is demoted
 * to the queue anyway. Slash commands keep the regular prompt path (the bridge
 * intercepts them there).
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { EventStreamListener } from "../backend/listener.js";
import type { ZcodeEvent } from "../backend/types.js";
import type { PendingTurn, ZcodeAcpServer } from "../server.js";
export interface GuideParams {
    sessionId: string;
    prompt: acp.ContentBlock[];
}
export type GuideResult = {
    outcome: "guided";
    inputId: string;
    delivery: string;
} | {
    outcome: "unavailable";
    reason: string;
};
/** `_zcode/guide` handler. Never throws: "unavailable" tells the client to fall back. */
export declare function guide(server: ZcodeAcpServer, params: GuideParams, client?: acp.AgentContext): Promise<GuideResult>;
/** True while a guide of this turn has not reached the model yet. */
export declare function hasOpenGuides(turn: PendingTurn): boolean;
/**
 * Guide bookkeeping for one backend event. Returns true when the event was a
 * steer event of one of this turn's guides — the caller must neither drop it
 * as attribution residue nor read it as a swallowed send.
 */
export declare function noteGuideEvent(turn: PendingTurn, ev: ZcodeEvent): boolean;
export type GuideFollowUp = {
    kind: "turn";
    staleTerminal: boolean;
} | {
    kind: "none";
} | {
    kind: "cancelled";
};
/**
 * The prompt's turn ended while a guide was still open: wait for the turn
 * that carries it, resuming the session queue when it does not start on its
 * own. On "turn" the guide turn's `turn.started` is back at the head of the
 * listener, and its entry is closed — the follow-up round owns it now.
 * `staleTerminal`: the finished turn's `prompt_completed` broadcast has not
 * arrived yet, so the follow-up round must not read it as its own.
 */
export declare function awaitGuideFollowUp(server: ZcodeAcpServer, deps: {
    turn: PendingTurn;
    listener: EventStreamListener;
    zcodeSid: string;
    acpSid: string;
    cx: acp.AgentContext;
}): Promise<GuideFollowUp>;
/**
 * Drop the guides that never reached the model (the prompt was cancelled or
 * failed): their queue items would otherwise sit in the session's queue and
 * surface as a paused queue in Desktop. Best-effort.
 */
export declare function discardOpenGuides(server: ZcodeAcpServer, turn: PendingTurn, zcodeSid: string): Promise<void>;
//# sourceMappingURL=guide.d.ts.map