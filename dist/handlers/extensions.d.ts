/**
 * ZCode-specific session method handlers (non-standard ACP extensions).
 *
 * Thin passthroughs for the extended session/* methods (0.14.8+):
 * fork/goal/compact/cancelBackgroundTask +
 * 0.15.0+: setThoughtLevel/updateRuntimeModelConfig/setModel/setMode.
 * (rewind/rewindCascade/steer existed up to 0.15.x; app-server 0.16+ removed
 * them in favor of the v4 conversation API, so the bridge dropped them.)
 *
 * These share a near-identical shape (resolve sid → build params → forward →
 * check error). Only the genuine per-method differences are spelled out:
 * fork's new sid mapping, compact/goal(set)'s internal-turn lock wait, and
 * setModel rerouting through updateRuntimeModelConfig.
 *
 * The settings methods (setModel/setThoughtLevel/setMode/updateRuntimeModel-
 * Config) emit the config_option_update broadcast afterwards: session settings
 * are per-SESSION, so a switch from any attached client must refresh the
 * others (phone ↔ CLI window). They receive the broadcast-proxy cx, whose
 * notify already fans out to every connection.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
interface ExtensionParams {
    sessionId: string;
    [key: string]: unknown;
}
type Result = Record<string, unknown>;
/** session/fork → zcode session/fork: branch a new session from a checkpoint. */
export declare function fork(server: ZcodeAcpServer, params: ExtensionParams): Promise<Result>;
/** session/goal → zcode session/goal: read/set/replace/clear/pause/resume the goal. */
export declare function goal(server: ZcodeAcpServer, params: ExtensionParams): Promise<Result>;
/** session/compact → zcode session/compact + wait for the internal AI turn. */
export declare function compact(server: ZcodeAcpServer, params: ExtensionParams, cx: acp.AgentContext): Promise<Result>;
/** session/cancelBackgroundTask → zcode session/cancelBackgroundTask. */
export declare function cancelBackgroundTask(server: ZcodeAcpServer, params: ExtensionParams): Promise<Result>;
/** session/setThoughtLevel → zcode session/setThoughtLevel. */
export declare function setThoughtLevel(server: ZcodeAcpServer, params: ExtensionParams, cx: acp.AgentContext): Promise<Result>;
/** session/updateRuntimeModelConfig → same: runtime overlay of session model config. */
export declare function updateRuntimeModelConfig(server: ZcodeAcpServer, params: ExtensionParams, cx: acp.AgentContext): Promise<Result>;
/** session/setModel → applyModelSwitch (runtime overlay, not persistence). */
export declare function setModel(server: ZcodeAcpServer, params: ExtensionParams, cx: acp.AgentContext): Promise<Result>;
/** session/setMode → zcode session/setMode + emit config_option/current_mode updates. */
export declare function setMode(server: ZcodeAcpServer, params: ExtensionParams, cx: acp.AgentContext): Promise<Result>;
/**
 * Wait for a zcode session's internal AI turn to release its prompt lock.
 *
 * `session/goal(set)` and `session/compact` start an internal AI turn that
 * keeps running after the request() response. projection.status=idle does NOT
 * mean the lock is released (goal set often shows idle quickly while the lock
 * persists 10-25s). The reliable check: retry a probe call (goal show) until it
 * no longer reports "prompt is running".
 *
 * `expectLock` (compact): compact's turn has a startup delay — at this moment
 * the lock isn't held yet, so a probe succeeds immediately (false "released").
 * With expectLock=true, we first require observing "prompt is running" once
 * (proving the turn truly started) before trusting a later success.
 *
 * `graceMs` bounds that lock-watching phase: if the lock is still unseen past
 * the grace, a successful probe counts as released. Without it, a turn that
 * finishes between two probes — or a backend whose lock error message drifted
 * away from "prompt is running" (version drift) — spins the full timeout and
 * reports a false failure.
 */
export declare function waitForTurnIdle(server: ZcodeAcpServer, zcodeSid: string, timeoutMs: number, probeMethod: string, expectLock: boolean, graceMs?: number): Promise<boolean>;
export {};
//# sourceMappingURL=extensions.d.ts.map