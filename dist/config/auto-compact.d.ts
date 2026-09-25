/**
 * Auto-compact: when the session's context-window usage exceeds a threshold,
 * automatically invoke `session/compact` so the next prompt has room.
 *
 * The threshold lives in `autoCompact.threshold` (~/.config/zcode-acp/
 * config.json; absolute token count) with `ZCODE_ACP_AUTO_COMPACT_THRESHOLD`
 * as the env fallback — 0/unset = disabled. The compaction target is decided
 * by the zcode backend — we only control *when* to trigger.
 *
 * Armed by `prompt()` after a successful `end_turn`, but run DETACHED via
 * runAutoCompactDetached once the turn's cleanup has landed (pendingTurns
 * delete + running:false turnState): awaiting it inside the turn kept the
 * FINISHED turn registered for the whole compaction, so any cancel or
 * follow-up prompt preempted it — stopBackendTurn plus the drain gate's
 * close escalation killed the compaction's internal AI turn, the dead lock
 * read as "released", and the bridge reported a false "✓ compressed" while
 * the context never shrank. Failures are best-effort (logged, never thrown).
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
import { autoCompactThreshold } from "./settings.js";
export { autoCompactThreshold };
/**
 * If the threshold is configured and the session's current context usage meets
 * or exceeds it, invoke `compact()`. No-op when the threshold is unset/zero,
 * when usage is below the threshold, or on any error (best-effort).
 */
export declare function maybeAutoCompact(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string): Promise<void>;
/**
 * Arm maybeAutoCompact as a session-level background task, single-flight per
 * backend session id: an armed-but-still-running compaction swallows later
 * arms (the running one covers them). MUST be called only after the arming
 * turn's cleanup (pendingTurns delete + running:false) — runOneTurn's finally
 * guarantees that ordering. Fire-and-forget; never rejects.
 */
export declare function runAutoCompactDetached(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string): void;
/** Worst-case compaction wall time: settle cap 300s + startup + probe gaps. */
export declare const AUTO_COMPACT_SETTLE_MS = 330000;
/**
 * Bounded wait until no detached auto-compact is in flight for the session.
 * Callers MUST wait before subscribing their event listener: a subscribed
 * listener would accumulate the compaction's internal-turn stream as residue
 * and dispatch it as the waiting prompt's own output. Waiting before the
 * subscribe is residue-free by construction, so the prompt path (user
 * messages), the goal-loop driver, and sandbox continuations all use this same
 * pre-subscribe hold.
 * Resolves false on timeout (the compaction may legitimately still run).
 */
export declare function waitForAutoCompactIdle(server: ZcodeAcpServer, zcodeSid: string, timeoutMs?: number): Promise<boolean>;
//# sourceMappingURL=auto-compact.d.ts.map