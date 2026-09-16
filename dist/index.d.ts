#!/usr/bin/env node
/**
 * Entry point: wire the ZcodeAcpServer to a stdio ACP stream.
 *
 * The ACP SDK provides `ndJsonStream(output, input)` which frames newline-
 * delimited JSON-RPC over a pair of web streams. We convert Node's stdin/
 * stdout to web streams and hand them off. Everything else (request/response
 * correlation, param validation, AbortSignal plumbing) is handled by the SDK.
 *
 * Invoked directly (`node dist/index.js`) or via the Unified CLI's `server`
 * subcommand / the `zcode-acp-server` bin alias (both resolve to `dist/cli.js`).
 */
export declare function main(): Promise<void>;
/**
 * Pure idle decision for the serve bridge: exit only when nothing is attached
 * (no ACP clients, no in-flight turns) AND that has been true for `idleMs`.
 * Busy ticks refresh `lastBusy` at the call site, so a long turn with all
 * clients gone still exits one idle window after it finishes — never mid-turn.
 */
export declare function serveIdleDecision(clients: number, pendingTurns: number, lastBusy: number, now: number, idleMs: number): boolean;
/**
 * Headless bridge for remote session-create (`zcode-acp serve`): the same ACP
 * surface as `main`, minus the stdio editor. Spawned detached by the hub with
 * cwd = the chosen project; its lifecycle is the mirror of ADR-0001 — instead
 * of following the editor's stdio, it follows remote interest: stays alive
 * while any client is attached or any turn runs, exits SERVE_IDLE_MS after
 * the last of those ends. Remote access is not optional here — without the
 * endpoint the process has no reason to exist, so a missing config or failed
 * endpoint exits instead of degrading.
 */
export declare function runHeadless(): Promise<void>;
//# sourceMappingURL=index.d.ts.map