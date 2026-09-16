/**
 * Vendored prompt templates for the goal loop (ADR-0022).
 *
 * These distill the format conventions of the Matt Pocock workflow skills
 * (to-tickets ticket shape, shift dispatch/VERDICT contracts, handoff rules)
 * but are FROZEN COPIES: the source skills are `disable-model-invocation` and
 * user-editable — reading them at runtime would let a user's local edits
 * change loop behavior. Do not "restore" live skill reads.
 */
import type { GoalTicket } from "./state.js";
/** Decompose the objective into vertical-slice tickets (round 0, uncounted). */
export declare function decomposePrompt(objective: string): string;
/** Parse the decompose reply; null when no ticket lines parse out. */
export declare function parseTickets(reply: string): Array<{
    title: string;
    acceptance: string;
}> | null;
/**
 * One-ticket dispatch prompt: objective restated (durable state re-injection),
 * the current ticket in full, hard boundaries, verdict contract, and — when
 * present — handoff read-back instruction and merged user steer text.
 */
export declare function dispatchPrompt(opts: {
    objective: string;
    ticket: GoalTicket;
    ticketIndex: number;
    ticketCount: number;
    handoffFile?: string;
    userText?: string;
}): string;
/**
 * Verification turn: re-run acceptance criteria, never trust the report. The
 * verdict is WRITTEN TO A FILE in a fixed format (far more reliable than
 * parsing a prose reply — observed 2026-09: verbose replies never matched the
 * bare-keyword contract and looped forever); the reply text is only a fallback.
 */
export declare function verifyPrompt(ticket: GoalTicket, verifyFile: string): string;
/**
 * Strict retry for an unreadable verification result: the verdict file was
 * missing or unparseable. One retry with this sharper contract; a still-
 * unreadable result pauses the loop instead of feeding a phantom FAIL back
 * (which loops forever).
 */
export declare function strictVerifyPrompt(ticket: GoalTicket, verifyFile: string): string;
/** Parse the verification FILE (strict: single PASS / FAIL: line). */
export declare function parseVerifyFile(content: string): {
    pass: boolean;
    reason?: string;
} | null;
/**
 * Parse the verification reply (fallback when no verdict file was written).
 * Explicit "FAIL:" wins; otherwise any affirmative pass/passed mention counts.
 * Negated statements ("2 of 5 checks did not pass", "couldn't make lint pass")
 * read as null — the safe path (strict retry → pause), never a silent PASS.
 */
export declare function parseVerifyReply(reply: string): {
    pass: boolean;
    reason?: string;
} | null;
/** The worker's self-reported verdict from the last assistant reply. */
export interface Verdict {
    kind: "met" | "not-yet" | "impossible";
    gaps?: string;
    why?: string;
}
/** Parse the trailing VERDICT line from a dispatch reply; null when absent. */
export declare function parseVerdict(reply: string): Verdict | null;
/**
 * Handoff turn prompt: the model writes the snapshot itself (rich state lives
 * in files, not in driver-managed blobs — see ADR-0022 §6). Distills the
 * handoff skill's rules: fixed path, no secrets, reference artifacts by path.
 */
export declare function handoffPrompt(opts: {
    objective: string;
    handoffFile: string;
}): string;
/** Post-compaction continuation note riding the next dispatch's user steer. */
export declare function handoffReadbackNote(handoffFile: string): string;
//# sourceMappingURL=templates.d.ts.map