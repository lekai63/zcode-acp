/**
 * Session-scoped background-task listener.
 *
 * Background sub-agents (the Agent/Task tool launched with `run_in_background:
 * true`) keep producing events AFTER `session/prompt` has returned: their
 * internal tool calls stream as `tool.updated`, and when they finish the
 * backend auto-triggers a notification turn (`turn.started` with
 * `inputSource:"background_task"`) whose `text_delta` carries the result.
 *
 * The per-prompt turn loop (`runEventTurn`) exits at `turn.completed` and
 * unregisters its listener, so without this module ALL of those post-turn
 * events are silently dropped — the user sees "background task launched" and
 * then nothing.
 *
 * This listener is registered once per session (lives across prompts) and
 * forwards a curated subset to the ACP client as out-of-band `session/update`
 * notifications:
 *
 *   - `session.updated` carrying `taskId`  → background task status change.
 *     First sighting emits a fresh `tool_call` card (`[background] …`);
 *     subsequent sightings emit `tool_call_update` with the new status.
 *   - `turn.started` with `inputSource:"background_task"` → marks the start
 *     of a notification turn; its `model.streaming text_delta` is forwarded
 *     as `agent_message_chunk` so the user sees the background result.
 *
 * Everything else is ignored — the turn loop handles normal turns and normal
 * tool calls. Per the design decision, background agents' INTERNAL tool calls
 * are NOT expanded here (only the task-level card + the final result message).
 *
 * All work is best-effort: failures are logged via `warn()` and never thrown
 * into the event loop (would crash the bridge, per AGENTS.md).
 */
import type { EventListener } from "../backend/client.js";
import type { ZcodeEvent } from "../backend/types.js";
import type { ZcodeAcpServer } from "../server.js";
export declare class BackgroundTaskListener implements EventListener {
    private readonly server;
    readonly zcodeSid: string;
    /** taskId → tracked state. */
    private readonly tasks;
    /**
     * The turnId of the currently-active background notification turn, if any.
     * While set, that turn's `model.streaming text_delta` events are forwarded
     * to the client as `agent_message_chunk`.
     */
    private activeNotifyTurnId;
    constructor(server: ZcodeAcpServer, zcodeSid: string);
    handleEvent(event: ZcodeEvent): void;
    /** Handle a `session.updated` carrying a background task status. */
    private onTaskStatus;
    /**
     * Push a status update for an already-tracked task. For background Bash
     * (reusesLaunchCard), a terminal-state transition also streams the final
     * output via terminal_output and closes the terminal UI with terminal_exit
     * (mirroring dispatchTerminalUpdate's 2-notification split), then clears
     * terminalSentData so the launch card is fully retired.
     */
    private emitStatusUpdate;
    /** Forward a text delta from the active background notification turn. */
    private forwardText;
    private firstMessageId;
    private activeMessageId;
    /**
     * Mark a tracked task as cancelled (used by `session/cancelBackgroundTask`).
     * Emits a final `failed` update with `_meta.backgroundTask.cancelled = true`
     * so the editor card reflects the cancellation, then drops local state. For
     * background Bash reusing a launch terminal card, also emits terminal_exit
     * and clears terminalSentData so the terminal UI closes cleanly.
     */
    markCancelled(taskId: string): Promise<void>;
    /**
     * Terminal record for tasks still in flight when the bridge (or its backend
     * subprocess) shuts down. The CLI runtime keeps its task registry in memory
     * and aborts silently on adapter close — no completion/termination event is
     * ever emitted, so the client's card would stay in_progress forever. Emit a
     * `failed` update with `shutdown: true` metadata instead (#194). Best-effort;
     * called from the bridge shutdown paths before the backend pipe closes.
     */
    emitShutdownRecords(): Promise<void>;
}
//# sourceMappingURL=background-tasks.d.ts.map