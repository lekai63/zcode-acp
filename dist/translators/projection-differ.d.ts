/**
 * ProjectionDiffer: diff two `{projection, messages, todos}` snapshots into
 * internal events.
 *
 * Used in three places:
 *   1. Turn completion — emit the final PlanUpdate / usage (text/tools are
 *      already deduped by seenMessageIds).
 *   2. Stall reconciliation — recover missed events from an authoritative
 *      `session/messages` snapshot.
 *   3. session/load — replay an initial plan.
 *
 * Only NEW messages (by message id dedup) are processed, so multi-turn/resume
 * history isn't re-emitted. The PlanUpdate fires whenever the todos signature
 * changes (including clearing to empty — the initial `_lastPlanSig = "__none__"`
 * makes the first empty list also emit).
 */
import type { ZcodeMessage, ZcodeSnapshot } from "../backend/types.js";
import type { InternalEvent } from "./types.js";
export declare class ProjectionDiffer {
    private readonly seenToolIds;
    private readonly lastToolStatus;
    private lastUsage;
    private readonly seenMessageIds;
    private lastPlanSig;
    private readonly seenPatchHashes;
    /** Whether any TextDelta fired this turn (used by fallback detection). */
    emittedTextThisTurn: boolean;
    /** Mark all given messages as seen (baseline so we don't re-emit history). */
    markSeen(messages: ZcodeMessage[]): void;
    /** Whether a message's dedup key has already been processed. */
    hasSeenMessage(m: ZcodeMessage): boolean;
    /**
     * Mark a tool call id as seen + completed. Used to sync state from the
     * EventTranslator so the next `diff()` won't re-emit a tool the event path
     * already dispatched (which would clear Bash terminal output via a
     * content-less ToolCallNew through the terminal path).
     */
    markToolSeen(callId: string): void;
    /** Reset per-turn flags (does NOT reset seenMessageIds). */
    resetTurn(): void;
    /** Set the usage baseline so the next diff won't re-emit the same value. */
    setLastUsage(used: number): void;
    /** Diff two snapshots. Returns 0..n events. */
    diff(curSnapshot: ZcodeSnapshot | null): InternalEvent[];
    /**
     * Detect a todos signature change and return a PlanUpdate event if it changed
     * (including clearing to empty — the initial `_lastPlanSig = "__none__"` makes
     * the first empty list also emit). Exposed so callers can run plan detection
     * mid-turn (e.g. right after a TodoWrite tool completes) without a full diff,
     * avoiding the lag of waiting until turn completion.
     */
    diffPlan(todos: unknown[] | undefined): InternalEvent[];
    private diffToolPart;
    private messageDedupKey;
}
//# sourceMappingURL=projection-differ.d.ts.map