/**
 * Opencode Go credential discovery — the LEGACY `~/.pi/agent/opencode-go.json`
 * fallback source.
 *
 * Full precedence (highest first), resolved in ../index.ts:
 *   1. `quota.opencodeGoWorkspaceId` / `quota.opencodeGoAuthCookie` in
 *      `~/.config/zcode-acp/config.json` (our own config).
 *   2. `OPENCODE_GO_WORKSPACE_ID` / `OPENCODE_GO_AUTH_COOKIE` env vars
 *      (best for CI / scripts / temporary overrides).
 *   3. `~/.pi/agent/opencode-go.json` — `{ workspaceId, authCookie }`
 *      (the convention used by the @beyona/pi-zai-usage Pi extension, kept so
 *      users who already configured it there get reuse for free).
 *
 * Both fields must resolve to a valid pair — a missing/invalid one yields
 * `not_configured`.
 */
/** Env var names — documented in the CLI help and README. */
export declare const ENV_WORKSPACE_ID = "OPENCODE_GO_WORKSPACE_ID";
export declare const ENV_AUTH_COOKIE = "OPENCODE_GO_AUTH_COOKIE";
/** Config file path (matches the @beyona/pi-zai-usage convention). */
export declare const CONFIG_PATH: string;
/** Shape of the JSON config file. */
interface OpencodeGoConfig {
    workspaceId?: string;
    authCookie?: string;
}
/**
 * Read (best-effort) the JSON config file. Returns an empty object on any
 * error — missing file, parse error, or wrong shape all degrade to "no fields
 * contributed", which the caller treats as `not_configured`.
 *
 * Best-effort mirrors {@link ../../backend/credentials.ts}: a missing or
 * corrupt config must never crash the bridge, only log.
 */
export declare function readConfigFile(filePath?: string): OpencodeGoConfig;
export {};
//# sourceMappingURL=config.d.ts.map