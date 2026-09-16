/**
 * Opencode Go usage orchestration — the entry point used by the
 * `zcode-acp quota` CLI.
 *
 * Flow: credentials (env + config file) → cache check → fetch → redirect/auth
 * check → parse → cache write. Any thrown error degrades to `unavailable`
 * rather than propagating, so the CLI always produces output.
 *
 * A missing/invalid credential pair yields `not_configured`, which the
 * combined view silently skips (vs. `unavailable`, which renders an error
 * line) — so users who only care about GLM see no noise.
 */
import type { GoQueryResult } from "./types.js";
/**
 * Query the Opencode Go dashboard and return a normalised {@link GoQueryResult}.
 *
 * - No credentials / invalid → `not_configured`.
 * - Serves a cached result when fresh (< 10s).
 * - HTTP redirect to login (final URL no longer contains the workspace path)
 *   → `auth_error`.
 * - Network/timeout/parse failure → `unavailable`.
 */
export declare function queryGoUsage(): Promise<GoQueryResult>;
export { clearCache, clearCache as clearGoCache } from "./cache.js";
export { fetchGoDashboard, dashboardUrl } from "./client.js";
export { parseGoDashboard, looksLikeDashboard } from "./parse.js";
export { formatDuration, formatGoSection } from "./format.js";
export { readConfigFile, CONFIG_PATH, ENV_WORKSPACE_ID, ENV_AUTH_COOKIE } from "./config.js";
export type { GoQueryResult, GoWindow, GoWindowKey, GoDashboardResponse } from "./types.js";
//# sourceMappingURL=index.d.ts.map