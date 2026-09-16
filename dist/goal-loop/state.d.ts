/**
 * Goal-loop persistent state (ADR-0022).
 *
 * Artifacts live under `.zcode/scratch/goals/<zcodeSid>/` keyed by the backend
 * session id (stable across bridge restarts, unlike the per-attach ACP id).
 * Rich context (progress, next steps) is NOT stored here by design — it lives
 * in the model-written handoff document (`.zcode/handoff/goal-<sid>.md`); this
 * file only holds what the DRIVER needs to resume: objective, round count,
 * ticket checklist, and the parked user text across a pause.
 *
 * Writes are temp-file + rename (the same discipline as the lazy-alias store,
 * though the sharing surface is much smaller: one writer per session loop).
 */
export type GoalTicketStatus = "pending" | "in_progress" | "done" | "blocked";
export interface GoalTicket {
    id: string;
    title: string;
    /** How to verify the ticket is done (rendered into dispatch + verify prompts). */
    acceptance: string;
    status: GoalTicketStatus;
    /** Last verification failure feedback (feeds the next dispatch round). */
    feedback?: string;
}
export type GoalLoopStatus = "running" | "paused" | "paused-budget" | "paused-stall" | "paused-crash" | "complete" | "impossible" | "stopped";
export interface GoalLoopState {
    objective: string;
    status: GoalLoopStatus;
    /** Completed dispatch rounds (verification/handoff/decompose turns excluded). */
    rounds: number;
    tickets: GoalTicket[];
    /** True right after compaction — the next dispatch must read the handoff doc. */
    handoffFresh: boolean;
    /** User text preserved across a pause, merged into the next dispatch. */
    parkedText?: string;
    createdAt: number;
    updatedAt: number;
    /** Final round count / reason when the loop reached a terminal status. */
    endedReason?: string;
}
/** Directory holding a session's goal artifacts (spec/tickets/state). */
export declare function goalDir(projectRoot: string, zcodeSid: string): string;
/** Handoff document path (model-written, read back after compaction). */
export declare function handoffPath(projectRoot: string, zcodeSid: string): string;
export declare function statePath(projectRoot: string, zcodeSid: string): string;
/** Verification result file (model-written, read by the driver — see ADR-0022). */
export declare function verifyPath(projectRoot: string, zcodeSid: string): string;
/** Read a session's goal state; null when none exists or it is unreadable. */
export declare function readGoalState(projectRoot: string, zcodeSid: string): GoalLoopState | null;
/** Atomically persist the goal state (temp file + rename). */
export declare function writeGoalState(projectRoot: string, zcodeSid: string, state: GoalLoopState): void;
/** Best-effort removal on /auto stop (terminal states keep the record). */
export declare function clearGoalState(projectRoot: string, zcodeSid: string): void;
//# sourceMappingURL=state.d.ts.map