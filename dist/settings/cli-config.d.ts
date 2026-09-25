/**
 * Read/write for the ZCode CLI config (`~/.zcode/cli/config.json`).
 *
 * ONE file, four independent owners: skills enablement, MCP servers, hooks, and
 * plugins. Every writer is therefore a read-modify-write that preserves keys it
 * does not recognise — the file also carries agent-runtime settings owned by
 * the backend, and rewriting from a partial model would silently delete them.
 *
 * The enable/disable spellings are not symmetric, and getting them wrong makes
 * a toggle look broken while the file is technically valid:
 *
 *  - **skills**: key = the SKILL.md absolute path, value `{enable: false}`.
 *    `enable: true` is the DEFAULT and must DELETE the key — writing `true`
 *    leaves a permanent override that shadows later enablement changes.
 *  - **MCP**: `enabled: false` inside the server object. Same rule: `true`
 *    deletes the key (and a legacy `enable` key is migrated on the way).
 *  - **hooks**: a whole different shape — a nested tree under `hooks`, gated by
 *    a top-level `hooks.enabled: true`. WITHOUT that flag every hook in the file
 *    is inert, which is the single most common way a hand-written config does
 *    nothing.
 *  - **plugins**: `enabledPlugins` / `suppressedBuiltins` maps keyed by
 *    `<name>@<marketplace>`.
 *
 * None of these are hot-reloaded by the agent: `cli/config.json` is read once
 * at agent start (MCP servers are frozen into the runtime config), except the
 * skills enablement map which the host re-reads live. Writes therefore report
 * `needs-restart` for MCP and hooks, `immediate` for skills.
 */
/** The seven hook events the schema accepts, in its own order. */
export declare const HOOK_EVENT_NAMES: readonly ["SessionStart", "UserPromptSubmit", "PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure", "Stop"];
export type HookEventName = (typeof HOOK_EVENT_NAMES)[number];
/** One hook entry. Passthrough in the schema — unknown keys are preserved. */
export interface HookEntry {
    type: "command" | "process";
    command: string;
    enabled?: boolean;
    async?: boolean;
    shell?: true | string;
    /** Seconds (only meaningful for `type: "command"`). */
    timeout?: number;
    /** Milliseconds; wins over `timeout` when both are present. */
    timeoutMs?: number;
    args?: string[];
    statusMessage?: string;
    [key: string]: unknown;
}
/** One matcher group under an event. STRICT in the schema — no unknown keys. */
export interface HookMatcher {
    matcher?: string;
    hooks: HookEntry[];
}
export interface HooksConfig {
    enabled?: boolean;
    timeoutMs?: number;
    maxOutputBytes?: number;
    events?: Partial<Record<HookEventName, HookMatcher[]>>;
}
export interface McpServerConfig {
    type?: string;
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
    enabled?: boolean;
    [key: string]: unknown;
}
export interface CliConfigFile {
    skills?: Record<string, {
        enable?: boolean;
    }>;
    mcp?: {
        servers?: Record<string, McpServerConfig>;
    };
    hooks?: HooksConfig;
    plugins?: {
        enabled?: boolean;
        dirs?: string[];
        enabledPlugins?: Record<string, boolean>;
        suppressedBuiltins?: string[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
/**
 * Read the CLI config.
 *
 * @throws when the file exists but is malformed. Unlike the app's skills
 *         writer (which silently reads damage as `{}` and would then rewrite
 *         the file from an empty base), this refuses — the caller surfaces an
 *         error instead of destroying what is left of the document.
 */
export declare function readCliConfig(): Promise<CliConfigFile>;
/** Structural check for the parts of the file this module owns. */
export declare function validateCliConfig(doc: Record<string, unknown>): boolean | string;
/**
 * Type-check the known MCP server fields before they reach the config file.
 *
 * The route passes the request body through to `upsertMcpServer` unmerged, and
 * the schema check above only asks "is it an object" — so without this a
 * `{"args": "npx"}` (string where the runtime expects an array) would persist
 * happily. It does NOT take the whole map down: the runtime validates each
 * entry separately and skips only the bad one (source: ZCode
 * `packages/adapters/src/config/schema.ts`, `normalizeConfigFileInput` —
 * per-entry `mcpServerSchema.safeParse` with a `config_mcp_server_invalid`
 * warning). What the user loses is the server they just added, disappearing
 * with no error anywhere in the bridge — so the write is refused here, where
 * the reason can be reported, instead of being silently dropped at the next
 * agent start. Unknown keys still pass through: the runtime keeps adding
 * fields and the file is not ours to narrow.
 */
export declare function validateMcpServer(name: string, server: unknown): boolean | string;
/**
 * Set a skill's enabled state.
 *
 * `enable: true` REMOVES the override rather than writing `true` — enabled is
 * the default state, and a stored `true` is a permanent pin that would shadow
 * the file's real state.
 */
export declare function setSkillEnabled(skillPath: string, enable: boolean): Promise<CliConfigFile>;
/**
 * Create or update an MCP server.
 *
 * `enabled: true` deletes the flag (and a legacy `enable` key) instead of
 * storing it; only a DISABLE is worth persisting.
 */
export declare function upsertMcpServer(name: string, server: McpServerConfig): Promise<CliConfigFile>;
/** Enable or disable an existing MCP server. */
export declare function setMcpServerEnabled(name: string, enabled: boolean): Promise<CliConfigFile>;
export declare function removeMcpServer(name: string): Promise<CliConfigFile>;
/**
 * Read the hooks tree. Returns the raw config; an absent file yields `{}`.
 *
 * Note the returned `enabled` flag: hooks are inert unless the top-level flag
 * is `true`, so callers must surface it rather than inferring it.
 */
export declare function readHooks(): Promise<HooksConfig>;
/**
 * Set the global hooks switch.
 *
 * A file full of hooks with `enabled` absent runs NOTHING — the runtime root
 * defaults to disabled. This is the one field that turns the whole tree on.
 */
export declare function setHooksEnabled(enabled: boolean): Promise<CliConfigFile>;
/**
 * Edit ONE existing hook entry in place.
 *
 * Deliberately not a create path: the matcher list is an array of arrays, and
 * an insert shifts every later index, so a remote "add a hook" call races with
 * any concurrent edit of the same event. Editing an existing entry's
 * command/timeout/enabled covers the real use case (temporarily disable one,
 * tweak a command) without that hazard.
 *
 * Unknown keys on the hook object are preserved: the schema is `.passthrough()`
 * precisely so extensions can ride along.
 */
export declare function updateHookEntry(event: HookEventName, matcherIndex: number, hookIndex: number, patch: Partial<Pick<HookEntry, "command" | "enabled" | "timeoutMs" | "timeout">>): Promise<CliConfigFile>;
/** Enable or disable a plugin by its `<name>@<marketplace>` key. */
export declare function setPluginEnabled(pluginKey: string, enabled: boolean): Promise<CliConfigFile>;
/** Raw text for the settings snapshot. Absent → null. */
export declare function readCliConfigRaw(): Promise<string | null>;
//# sourceMappingURL=cli-config.d.ts.map