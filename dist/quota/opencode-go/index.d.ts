/**
 * Opencode Go usage orchestration — the entry point used by the
 * `zcode-acp quota` CLI and the quota dock.
 *
 * Flow: credentials (env + config file) → cache check → fetch → status/auth
 * check → parse → cache write. Any thrown error degrades to `unavailable`
 * rather than propagating, so the CLI always produces output.
 *
 * A missing/invalid credential triple yields `not_configured`, which the
 * combined view silently skips (vs. `unavailable`, which renders an error
 * line) — so users who only care about GLM see no noise.
 */
import type { GoQueryResult } from "./types.js";
/**
 * Query the Opencode Go console status API and return a normalised
 * {@link GoQueryResult}.
 *
 * - No credentials / invalid → `not_configured`.
 * - Serves a cached result when fresh (< 10s).
 * - HTTP 400/401/403 → `auth_error` (bad/missing org id or cookie pair).
 * - Network/timeout/parse failure → `unavailable`.
 */
export declare function queryGoUsage(): Promise<GoQueryResult>;
export { clearCache, clearCache as clearGoCache } from "./cache.js";
export { fetchGoStatus, goStatusUrl } from "./client.js";
export { parseGoStatus, looksLikeGoStatus } from "./parse.js";
export { formatDuration, formatGoSection } from "./format.js";
export { readConfigFile, CONFIG_PATH, ENV_WORKSPACE_ID, ENV_AUTH_COOKIE, ENV_SESSION_TOKEN, } from "./config.js";
export type { GoQueryResult, GoWindow, GoWindowKey, GoStatusResponse } from "./types.js";
//# sourceMappingURL=index.d.ts.map