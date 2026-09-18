/**
 * Resolve the argv to launch the ZCode app-server subprocess.
 *
 * The ZCode CLI is a Node `.cjs` that relies on a `#!/usr/bin/env node` shebang.
 * Processes launched by GUI launchd (no shell profile) have no `node` on PATH,
 * so the shebang fails. We sidestep it by constructing `[node, zcode.cjs,
 * "app-server", "--stdio"]` with an explicit, sqlite-capable Node binary.
 */
export declare const BUILTIN_PROVIDER_ENV = "ZCODE_BUILTIN_PROVIDER_CONFIG_FILE";
export declare const PERSONAL_PROVIDER_ENV = "ZCODE_PERSONAL_PROVIDER_CONFIG_FILE";
/**
 * Env vars pointing the CLI at its provider tables, mirroring the desktop
 * host's own injection. Locates the builtin file next to the resolved CLI
 * entry (sibling `provider/` — npm/dev layout — or `../config/provider/` —
 * the .app bundle layout) and returns BOTH
 * `{ZCODE_BUILTIN_PROVIDER_CONFIG_FILE, ZCODE_PERSONAL_PROVIDER_CONFIG_FILE}`;
 * `{}` when the entry is not a JS file, is missing, or carries no provider
 * config anywhere (old CLIs, PATH installs) — those boot without one.
 *
 * BOTH vars are required: the CLI's provider bootstrap uses the injected
 * builtin path VERBATIM only when the personal var is set too — with the
 * builtin alone it re-syncs the table into a version-keyed runtime copy
 * (`~/.zcode/v2/runtime/provider/<plat>/<version>/<endpoint dir>/zcode-builtin.json`)
 * and rewires
 * its configRevision to THAT copy's path. The account-config push's
 * `basedOnZcodeBuiltinRevision` hashes the injected path, so any rewire
 * silently voids the push and every account model answers "Provider
 * Registry 中不存在 Model" (observed 2026-09: one terminal env took the
 * re-sync path deterministically while another never did). The personal
 * value is the CLI's own default location, just made explicit to unlock the
 * verbatim branch.
 *
 * The derived value deliberately OVERRIDES any inherited ambient env: the
 * host injects version-keyed runtime paths
 * (`…/runtime/provider/<plat>/<appVersion>/endpoint-<hash>/zcode-builtin.json`)
 * that go stale or vanish across app updates, while the derived path always
 * matches the entry about to be launched. Only a {} result (no adjacent
 * config) leaves the ambient value untouched — for a non-bundled CLI that
 * ambient value is the best hint.
 */
export declare function builtinProviderEnv(entryArg?: string): NodeJS.ProcessEnv;
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