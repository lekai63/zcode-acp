/**
 * Resolve the argv to launch the ZCode app-server subprocess.
 *
 * The ZCode CLI is a Node `.cjs` that relies on a `#!/usr/bin/env node` shebang.
 * Processes launched by GUI launchd (no shell profile) have no `node` on PATH,
 * so the shebang fails. We sidestep it by constructing `[node, zcode.cjs,
 * "app-server", "--stdio"]` with an explicit, sqlite-capable Node binary.
 */
/**
 * The backend subcommand and its flags, shared by every launch path.
 *
 * `ZCODE_DISALLOWED_TOOLS` is merged with the default Cron* disallow list
 * (see AUTOMATION_TOOL_DEFAULTS) and passed as the app-server's
 * `--disallowed-tools` value; unset means only the defaults.
 */
export declare function backendArgs(): string[];
/** Resolve the full argv to launch `zcode app-server --stdio`. */
export declare function resolveZcodeCommand(): string[];
//# sourceMappingURL=resolve.d.ts.map