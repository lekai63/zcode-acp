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
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { log } from "../utils.js";
/** Directory holding a session's goal artifacts (spec/tickets/state). */
export function goalDir(projectRoot, zcodeSid) {
    return path.join(projectRoot, ".zcode", "scratch", "goals", zcodeSid);
}
/** Handoff document path (model-written, read back after compaction). */
export function handoffPath(projectRoot, zcodeSid) {
    return path.join(projectRoot, ".zcode", "handoff", `goal-${zcodeSid}.md`);
}
export function statePath(projectRoot, zcodeSid) {
    return path.join(goalDir(projectRoot, zcodeSid), "state.json");
}
/** Verification result file (model-written, read by the driver — see ADR-0022). */
export function verifyPath(projectRoot, zcodeSid) {
    return path.join(goalDir(projectRoot, zcodeSid), "verify.txt");
}
/** Read a session's goal state; null when none exists or it is unreadable. */
export function readGoalState(projectRoot, zcodeSid) {
    try {
        const raw = JSON.parse(readFileSync(statePath(projectRoot, zcodeSid), "utf8"));
        if (typeof raw !== "object" ||
            raw === null ||
            typeof raw.objective !== "string" ||
            !Array.isArray(raw.tickets)) {
            // Corrupt/hand-edited state reads as absent — a malformed tickets list
            // would otherwise throw inside the driver's round loop.
            return null;
        }
        return raw;
    }
    catch {
        return null;
    }
}
/** Atomically persist the goal state (temp file + rename). */
export function writeGoalState(projectRoot, zcodeSid, state) {
    state.updatedAt = Date.now();
    const dir = goalDir(projectRoot, zcodeSid);
    const target = statePath(projectRoot, zcodeSid);
    const tmp = `${target}.tmp-${process.pid}`;
    try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(tmp, JSON.stringify(state, null, 2));
        renameSync(tmp, target);
    }
    catch (e) {
        log(`goal-loop: state write failed (${e instanceof Error ? e.message : String(e)}) — continuing`);
        try {
            unlinkSync(tmp);
        }
        catch {
            /* nothing to sweep */
        }
    }
}
/** Best-effort removal on /auto stop (terminal states keep the record). */
export function clearGoalState(projectRoot, zcodeSid) {
    try {
        unlinkSync(statePath(projectRoot, zcodeSid));
    }
    catch {
        /* absent — fine */
    }
}
//# sourceMappingURL=state.js.map