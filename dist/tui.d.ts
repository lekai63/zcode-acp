/**
 * Martty TUI launcher — the interactive CLI surface (ADR-0020).
 *
 * Bare `zcode-acp` spawns the bundled Martty terminal client (npm
 * `zcode-acp-martty`: this fork of upstream Martty, a Node wrapper selecting
 * a per-platform Rust binary from its vendor/ dir) with this package wired in
 * as its ACP agent:
 *
 *   martty --agent <node> --agent-arg <dist/index.js>
 *
 * Martty owns the UI; this package stays the protocol bridge. The launcher
 * shares stdio with the child and inherits the environment, and Martty passes
 * its environment through to the spawned agent (verified) — the hub's
 * ZCODE_ACP_RESUME_SESSION boot-resume target (ADR-0017) reaches the bridge,
 * where session/new serves it as a session/load.
 */
/** Path to Martty's Node wrapper (bin/martty.js), or null when not installed. */
export declare function resolveMarttyJs(): string | null;
/** Absolute path of this package's ACP agent entry (dist/index.js). */
export declare function agentEntryJs(): string;
/**
 * Martty argv (after the wrapper script) wiring the bridge in as its agent.
 * The interpreter defaults to the dual-runtime choice (bun --smol when
 * available, else the current Node binary) — absolute paths avoid PATH/shebang
 * differences across platforms, and each --agent-arg is exactly one argv
 * token, so interpreter flags ride as their own tokens before the entry.
 * Pure — exported for unit tests.
 */
export declare function buildTuiArgs(agentJs: string, interp?: {
    command: string;
    preArgs: string[];
}): string[];
/**
 * Run the interactive Martty TUI in this terminal. Resolves when Martty exits
 * and mirrors its exit code. Signals aimed at this process are forwarded so a
 * SIGTERM from a supervisor reaches the TUI too (terminal ctrl+c already hits
 * the whole foreground process group).
 */
export declare function runTui(): Promise<void>;
/**
 * Headless wiring check (CI / smoke): Martty spawns the bridge, runs the ACP
 * initialize handshake, prints agent info, and exits. True on exit 0.
 */
export declare function checkTuiRuntime(): Promise<boolean>;
/** Martty home resolution: env MARTTY_HOME → $DSH_HOME/.martty → ~/.martty. */
export declare function resolveMarttyHome(env?: NodeJS.ProcessEnv): string;
/** What the seeder decided for an existing plugin.json. */
export interface SeedPlan {
    /** "write" = create/update the file; "none" = nothing to do; "skip" = never overwrite. */
    action: "write" | "none" | "skip";
    /** "current" = ours, same version · "update" = ours, older · others = skip reasons. */
    reason: "fresh" | "current" | "update" | "foreign" | "modified" | "unparseable";
}
/**
 * Decide whether to seed the quota dock plugin, comparing the on-disk
 * plugin.json against our shipped asset. We write only when the file is
 * missing or provably our own OLDER version (source.pluginId marker + the
 * version suffix of source.packageId, mirroring the martty plugin store's
 * artifact format). Same-version files that differ from our asset, foreign
 * plugins, and unparseable files are never touched (user modifications).
 * Pure — exported for unit tests.
 */
export declare function planQuotaSeed(existingContent: string | null, assetContent: string): SeedPlan;
/**
 * Seed the quota dock plugin into $MARTTY_HOME/plugins/<artifactId>/ before
 * martty starts (ADR-0021). Best-effort: any failure warns and never blocks
 * the TUI. The asset ships with the npm package (assets/martty-plugins), one
 * directory level above the compiled dist/tui.js.
 */
export declare function seedMarttyQuotaPlugin(env?: NodeJS.ProcessEnv): boolean;
//# sourceMappingURL=tui.d.ts.map