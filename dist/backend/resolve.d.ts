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
 * `ZCODE_DISALLOWED_TOOLS` is passed verbatim as the app-server's
 * `--disallowed-tools` value; unset means the flag is absent, which is the
 * backend's own default.
 */
export declare function backendArgs(): string[];
/** Resolve the full argv to launch `zcode app-server --stdio`. */
export declare function resolveZcodeCommand(): string[];
//# sourceMappingURL=resolve.d.ts.map