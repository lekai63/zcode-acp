/**
 * EventTranslator: turn zcode `session/event` pushes into internal event dicts.
 *
 * The output shape matches `ProjectionDiffer.diff()` (the `InternalEvent` union)
 * so either can feed `dispatchEvent`. State held per-translator:
 *   - seenToolIds / toolNames / toolInputs / finalToolIds for tool lifecycle
 *   - turnStarted / turnDone / turnFailed / turnResultType / turnError for turn state
 *
 * A critical quirk: zcode streams tool input via `model.streaming tool_call`
 * BEFORE the `tool.updated scheduled` event, whose `input` is then omitted
 * (`inputOmitted:true`). So we cache input from `tool_call` and fall back to
 * it when `scheduled` arrives without input.
 */
import type { InternalEvent } from "./types.js";
interface ZcodeEventPayload {
    type?: string;
    payload?: Record<string, unknown>;
}
export declare class EventTranslator {
    turnStarted: boolean;
    turnDone: boolean;
    turnFailed: boolean;
    turnResultType: string | null;
    turnError: Record<string, unknown> | null;
    /**
     * Usage object from this turn's `turn.completed` payload, verbatim from the
     * backend. The backend merges every model call's usage into one billing-
     * grade object ({source, modelRequestCount, inputTokens, outputTokens,
     * totalTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens,
     * webFetchRequests, webSearchRequests}); it is omitted when no model call
     * reported usage. Per-turn scope, not session-cumulative. Consumed by the
     * prompt loop to fill the ACP `PromptResponse.usage` field.
     */
    turnUsage: Record<string, unknown> | null;
    /**
     * True while inside a background-task notification turn
     * (`turn.started {inputSource:"background_task"}`). Set on its turn.started,
     * cleared on the next user-initiated turn.started. While true, `translate`
     * drops all events — that turn is owned by BackgroundTaskListener.
     */
    private skippingBackgroundTurn;
    /**
     * turnId of the user turn this translator owns (from its `turn.started`).
     * Backend-internal turns (`session/goal` set, `session/compact`) emit their
     * own turn.started/turn.completed on the SAME session mid-turn: without
     * attribution, their turn.completed flipped turnDone and the bridge ended
     * the user's turn while the backend kept generating (the "ghost completed"
     * remote-status bug). turnId-less backends keep the old behavior (both ids
     * must be present for a mismatch to drop an event).
     */
    private activeTurnId;
    private skippingForeignTurn;
    /**
     * Backend message ids (`assistantMessageId`) whose TEXT reached this
     * translator via the live event stream. Used by the turn loop to dedup the
     * turn-completion fallback replay: a message already streamed live must not
     * be re-emitted by `ProjectionDiffer.diff()`, while messages produced while
     * no listener was attached (e.g. a backend turn resumed after compaction)
     * have no live deltas and must be replayed.
     *
     * TEXT-only by contract. Text and reasoning share one assistant message id
     * (the differ tags both replays with `m.info.id`), and GLM-style backends
     * stream the text live while the CoT reaches us only via the completion
     * snapshot — a shared set would let the streamed text suppress the reasoning
     * replay entirely.
     */
    readonly deliveredMessageIds: Set<string>;
    /**
     * Same contract as `deliveredMessageIds`, for REASONING content. Kept
     * separate so live-streamed reasoning never suppresses the differ's
     * reasoning replay (and vice versa: streamed text must not).
     */
    readonly deliveredReasoningMessageIds: Set<string>;
    /** Tool call ids we've already emitted a ToolCallNew for. */
    readonly seenToolIds: Set<string>;
    /** call_id → tool_name (result/error events omit toolName). */
    readonly toolNames: Map<string, string>;
    /** call_id → input dict cached from model.streaming tool_call. */
    readonly toolInputs: Map<string, unknown>;
    /** Tool call ids that reached a terminal state (result/error). */
    readonly finalToolIds: Set<string>;
    /**
     * call_ids launched with `run_in_background: true`. Populated when the
     * scheduled event resolves the input (streaming cache or payload), so the
     * later `result` event — whose input is omitted — can still mark its
     * ToolCallUpdate as background. Read by `translateTool` to thread the flag
     * through to dispatch (which skips terminal_exit for background Bash).
     */
    readonly backgroundCallIds: Set<string>;
    /** Translate one zcode event into 0..n internal events. */
    translate(event: ZcodeEventPayload): InternalEvent[];
    /**
     * `state.updated` → one ConfigChanged event carrying the new settings values.
     * Payload shape (wrapped from the backend notification's params):
     *   { patch: { mode: {current}, model: {current:{providerId,modelId}},
     *              thoughtLevel: {current} }, reason, revision, sessionId }
     * Fields missing from the patch are omitted — the dispatcher only emits
     * updates for what actually changed.
     */
    private translateStateUpdated;
    private translateStreaming;
    private translateTool;
    /** Create the first ACP tool event, even if the backend omitted `scheduled`. */
    private createToolCall;
    private translateTurnDone;
}
export {};
//# sourceMappingURL=event-translator.d.ts.map