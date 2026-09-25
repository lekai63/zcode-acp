/**
 * Single merge point for user preferences: config file > env var > default.
 *
 * Every accessor reads the file live (via loadUserConfig, no cache) so an
 * edit takes effect on the next use without a bridge restart — same
 * convention the remote prefs established. Env vars stay a full fallback:
 * per-field precedence is file value (when present AND valid) > env var >
 * built-in default. See src/config/user-config.ts for the file schema.
 */
/** Auto-compact trigger: absolute token count; 0 = disabled. */
export declare function autoCompactThreshold(env?: NodeJS.ProcessEnv): number;
/** Goal-loop hard round budget before a pause (default 100). */
export declare function goalMaxTurns(env?: NodeJS.ProcessEnv): number;
/** Escape hatch routing /goal through the legacy backend goal mode. */
export declare function goalModeIsBackend(env?: NodeJS.ProcessEnv): boolean;
/** Mode a newly created session starts in (default "yolo"). */
export declare function initialSessionMode(env?: NodeJS.ProcessEnv): string;
/**
 * Wait cap (ms) for permission/elicitation requests; 0 = wait forever.
 * Resolved once at bridge start (module-load const in server-requests.ts) —
 * same lifetime as the env var it generalizes.
 */
export declare function interactionTimeoutMs(env?: NodeJS.ProcessEnv): number;
/** Global Seatbelt arming switch (per-project opt-in stays in sandbox.json). */
export declare function globalSandboxEnabled(env?: NodeJS.ProcessEnv): boolean;
/** Verbose diagnostic logging flag. */
export declare function debugEnabled(env?: NodeJS.ProcessEnv): boolean;
/**
 * TUI stats-dock segment filter (martty's DSH_TUI_STATS vocabulary). The
 * file value wins over the env var: the hub daemon that incubates TUI
 * windows is long-lived and detached, so its birth env predates most shell
 * exports — an env-only preference silently stops reaching every window the
 * hub opens afterwards. Undefined = martty's default (full dock).
 */
export declare function tuiStatsSegments(env?: NodeJS.ProcessEnv): string | undefined;
/**
 * Explicit user-facing-string language override ("zh" | "en"); undefined
 * lets the caller's fallback chain (app locale → POSIX → en) decide.
 * Prefix-tolerant on both sources ("zh_CN" reads as "zh"), like the env-only
 * picker in i18n.ts always was.
 */
export declare function languageOverride(env?: NodeJS.ProcessEnv): "zh" | "en" | undefined;
//# sourceMappingURL=settings.d.ts.map