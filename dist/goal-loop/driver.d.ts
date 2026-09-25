/**
 * Goal-loop driver (ADR-0022): the bridge-driven autonomous turn chain.
 *
 * Round shape: one ticket per `session/send` turn via the shared
 * {@link runOneTurn} machinery, a worker self-report VERDICT, and — only on a
 * claimed `met` — one verification turn that re-runs the acceptance criteria
 * (never trust the worker's report). Compaction runs at round boundaries
 * (handoff turn → session/compact → the next dispatch reads the handoff doc).
 *
 * User interaction: rounds register in `pendingTurns` with `goalLoop: true`
 * INSIDE withPreemptLock — `preemptInFlightTurn` skips them and the prompt
 * path parks the incoming prompt on the driver instead (merge at the next
 * boundary). ESC/cancel still cancels the in-flight round (pause follows).
 * While prompts are parked, a 60s keepalive keeps clients from hitting their
 * idle deadlines during the quiet judge/compaction windows.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
/** ENV: ZCODE_ACP_GOAL_MAX_TURNS — hard round budget before a pause. */
export declare function goalMaxTurns(): number;
/** Goal-loop compaction threshold: the shared threshold, else 80% of window. */
export declare function goalCompactThreshold(contextWindow: number): number;
export declare class GoalLoopDriver {
    readonly zcodeSid: string;
    private readonly server;
    private readonly acpSid;
    private state;
    private pauseFlag;
    private stopFlag;
    private parked;
    private parkSeq;
    /** Resolvers for prompt requests held open across the whole loop. */
    private holds;
    private keepalive;
    private runId;
    /** Set when the last goal turn was cancelled by the sandbox allow-restart. */
    private lastSandboxRestart;
    /**
     * Consecutive backend-lost recoveries by run()'s catch (the per-turn
     * recovery inside runOneTurn already respawns twice before giving up —
     * this counter only bounds the loop-level last resort). Reset on any
     * round that completes without losing the backend.
     */
    private backendRecoveries;
    private static readonly MAX_BACKEND_RECOVERIES;
    private constructor();
    /** Live driver for a session, when a loop is running. */
    static live(server: ZcodeAcpServer, zcodeSid: string): GoalLoopDriver | undefined;
    /**
     * Start (or resume) the loop for a session. Resuming adopts the persisted
     * state (round count, tickets, parked text); a fresh start decomposes the
     * objective into tickets first.
     */
    static start(server: ZcodeAcpServer, acpSid: string, zcodeSid: string, objective: string, opts?: {
        resume?: boolean;
    }): GoalLoopDriver;
    /**
     * Hold an ACP prompt request open until the loop settles (completed,
     * paused, or stopped), resolving with a final status line. Unlike
     * parkPrompt, no text merges into rounds. Clients like Paseo only render
     * live session/update events while a prompt turn is active — a
     * fire-and-forget start made every round invisible to them.
     */
    holdRequest(): Promise<string>;
    private settleHolds;
    /** Pause at the next round boundary (the in-flight round keeps running). */
    pause(): void;
    /**
     * External pause request — session/cancel during a quiet window with no
     * registered turn (e.g. compact()'s internal wait): same flag as pause(),
     * consumed at the next boundary.
     */
    requestPause(): void;
    /** Clear a pending pause/stop (/auto resume before the boundary takes it). */
    resume(): void;
    /** Stop at the next boundary and clear persisted state. */
    stop(): void;
    /** One-line status for /auto status. */
    statusText(): string;
    /**
     * Park an incoming user prompt (called by the prompt path when a goalLoop
     * turn is in flight). Resolves when the merged round completes — or
     * `cancelled` if the loop pauses/stops first (text preserved in state).
     */
    parkPrompt(text: string): Promise<acp.PromptResponse>;
    private armKeepalive;
    private disarmKeepalive;
    /**
     * Resolve parked prompts. Without a `snapshot`, everything currently parked
     * settles (pause/stop/end-of-loop paths). With one, ONLY the snapshot's
     * entries resolve — prompts parked DURING a round (the common steering
     * window) stay parked and their text merges into the NEXT round instead of
     * being silently resolved-and-dropped (ADR-0022 §3).
     */
    private settleParked;
    /** One goal-loop turn through the shared runOneTurn (goalLoop-marked). */
    private runGoalTurn;
    /** Consume the sandbox-restart mark set by the last runGoalTurn. */
    private consumeSandboxRestart;
    /**
     * Wait out in-flight NON-goal turns for this session before the first
     * round: a send landing mid-generation is accepted as steer input and its
     * text silently dropped when the old turn finishes (see AGENTS.md) — the
     * decompose prompt would be injected into the foreign conversation and the
     * tickets parsed from its reply. Real agent turns run minutes, so on timeout
     * the wait PRE-EMPTS the editor turn with the same semantics a normal
     * prompt uses (cancel flag + stop pair via preemptInFlightTurn) — proceeding
     * would land the decompose send as steer input into the live conversation.
     * runOneTurn's drain gate, armed by the pre-empt's lastCancelledAt mark,
     * settles the backend before the decompose send.
     */
    private waitForEditorTurnsIdle;
    /**
     * Id of the newest stored message (null when the store is empty) — the
     * cursor the round's other reads scope themselves with. `limit: 1` makes
     * this a tail read: the full-history transfer it replaces existed only to
     * produce a count.
     */
    private lastMessageId;
    /**
     * Text of the last assistant reply appended after `afterId` (the whole
     * history when null — verdict and ticket parsing read the session's final
     * reply). A turn's reply is its newest message, so the cursor-less case
     * caps the read at a tail window instead of transferring everything.
     */
    private lastAssistantText;
    /** Tool-part count among the messages appended after `afterId` (stall signal). */
    private toolActivitySince;
    private contextUsed;
    private announce;
    private persist;
    private endLoop;
    private run;
    private runRounds;
    private contextWindowFromRead;
    /**
     * Handoff turn → session/compact → mark handoffFresh for the next round.
     * Returns true when the handoff turn was cancelled (ESC / restart).
     */
    private compactBoundary;
}
//# sourceMappingURL=driver.d.ts.map