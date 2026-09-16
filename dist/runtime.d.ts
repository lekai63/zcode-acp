/**
 * Dual-runtime launcher support: prefer Bun (>=1.4, `--smol`) for this
 * package's own long-lived processes (bridge, hub, serve, TUI agent), fall
 * back to the current Node interpreter. The zcode backend subprocess is NOT
 * covered — `zcode.cjs` unconditionally loads `node:sea`, which Bun does not
 * implement, so backend resolution stays on real Node (src/backend/resolve.ts).
 *
 * Why Bun 1.4 minimum: measured on this package, 1.3.x had no memory benefit
 * over Node (~84 MB vs 81 MB idle), while 1.4.x runs the bridge in ~58 MB
 * (47 MB with --smol) vs Node's 81 MB — decisive for users running many
 * concurrent sessions.
 *
 * ZCODE_ACP_RUNTIME selects the policy: "node" forces Node (troubleshooting
 * escape hatch), "bun" prefers Bun and warns when unavailable, unset/auto
 * prefers Bun silently when a >=1.4 install is found. Failures of the probe
 * itself never block startup — Node is the safe default.
 */
/** Interpreter decision for spawning one of this package's JS entries. */
export interface RuntimeLaunch {
    command: string;
    /** Interpreter flags placed before the JS entry (e.g. ["--smol"] for Bun). */
    preArgs: string[];
}
/** Parse "1.4.2" → [1, 4, 2]; null when unparseable. */
export declare function parseBunVersion(out: string): [number, number, number] | null;
/** True when the parsed version meets MIN_BUN. Pure — exported for tests. */
export declare function bunVersionOk(v: [number, number, number] | null): boolean;
export declare function detectBun(): string | null;
/** Reset the probe cache (tests). */
export declare function resetRuntimeCache(): void;
/**
 * The interpreter decision for this process's lifetime. When already running
 * under Bun, reuses it (execPath) — no nested re-resolution.
 */
export declare function resolveRuntime(): RuntimeLaunch;
/** Full child argv to run `jsFile` (plus trailing args) under the chosen runtime. */
export declare function runtimeArgv(jsFile: string, ...rest: string[]): string[];
/** Spawn-spread form of runtimeArgv: spawn(...runtimeSpawnParts(js), opts). */
export declare function runtimeSpawnParts(jsFile: string, ...rest: string[]): [string, string[]];
/**
 * Hand this process over to Bun when eligible: spawn the same entry under
 * `bun --smol` with inherited stdio and mirror its exit code. Loop-safe by
 * construction — under Bun `process.versions.bun` is set and detectBun is
 * skipped, so the child never re-execs. Resolves true when the handover is in
 * progress (the caller must return immediately; this process exits with the
 * child), false when the caller should keep running in-process — Bun is
 * unavailable, Node was forced via ZCODE_ACP_RUNTIME=node, or the spawn
 * itself failed (nothing has been written to stdio yet, so the fallback is
 * safe).
 */
export declare function reexecToBunIfEligible(entryJs: string, argv: readonly string[]): Promise<boolean>;
//# sourceMappingURL=runtime.d.ts.map