/**
 * Global user configuration (~/.config/zcode-acp/config.json).
 *
 * The file is the AUTHORITATIVE source for user preferences that must not
 * depend on how a process was launched: the hub daemon is idle-exited and
 * re-spawned by whichever bridge needs it next, so its birth env rotates
 * between GUI-launched editors (no shell rc vars) and interactive shells.
 * Every read is live (no cache) — editing the file takes effect on the next
 * use (e.g. the next remote incubation) without restarting the hub.
 *
 * Precedence everywhere: config file > environment variable > built-in
 * default. Env vars remain fully supported as a fallback for setups without
 * a file and for one-off/test overrides of unspecified fields.
 *
 * Per-process plumbing (ZCODE_ACP_REMOTE_ORIGIN, _PIN_CWD,
 * ZCODE_ACP_RESUME_SESSION) is deliberately NOT file-configurable — those
 * carry per-request/per-role state, not user preference.
 */
/** Terminal incubation preferences for remote session-create (ADR-0016). */
export interface TerminalPrefs {
    /** false → remote session-create stays headless (no visible window). */
    enabled?: boolean;
    /**
     * Ordered terminal preference list — the hub tries them in order (a launch
     * failure or a window that never registers moves down the list) and only
     * goes headless once every entry failed. Names resolve like `app`.
     */
    terminals?: string[];
    /** Terminal app name (Terminal, iTerm, wezterm, kitty, alacritty, ghostty, …). */
    app?: string;
    /** Shell command template; `{script}` is replaced with the quoted script path. */
    command?: string;
}
/** The `remote` section of the user config file. */
export interface RemoteUserConfig {
    enabled?: boolean;
    token?: string;
    hubPort?: number;
    hubHost?: string;
    bridgePort?: number;
    terminal?: TerminalPrefs;
}
export interface UserConfig {
    remote?: RemoteUserConfig;
}
/** Resolve the config file path: $XDG_CONFIG_HOME/zcode-acp or ~/.config/zcode-acp. */
export declare function userConfigPath(env?: NodeJS.ProcessEnv): string;
/**
 * Read and validate the user config. Best-effort: a missing file is the
 * normal no-file path ({}), anything unreadable/malformed warns once and
 * reads as absent so the env fallback keeps the process working.
 */
export declare function loadUserConfig(env?: NodeJS.ProcessEnv): UserConfig;
//# sourceMappingURL=user-config.d.ts.map