/**
 * Ollama Cloud usage orchestration — the entry point used by the
 * `zcode-acp quota` CLI.
 *
 * Flow: credential (env + config file) → cache check → fetch → status/auth
 * check → parse → cache write. Any thrown error degrades to `unavailable`
 * rather than propagating, so the CLI always produces output.
 *
 * A missing API key yields `not_configured`, which the combined view silently
 * skips — so users who only care about GLM see no noise.
 */
import type { OcQueryResult } from "./types.js";
/** Session window length: a rolling 5h bucket anchored at the Unix epoch. */
export declare const SESSION_WINDOW_MS: number;
/** Weekly window anchor: Monday 00:00 UTC (the epoch was a Thursday, so the
 *  first Monday sits 4 days in) — same inference as the pi-multi-account
 *  reference client. */
export declare const WEEK_ANCHOR_MS: number;
/**
 * Next reset of the epoch-aligned 5h session bucket strictly after `t`.
 * The anchoring is inferred from observed bucket behaviour (undocumented).
 */
export declare function nextSessionReset(t: number): number;
/** Next Monday 00:00 UTC strictly after `t` (the weekly window reset). */
export declare function nextWeeklyReset(t: number): number;
/**
 * Next monthly anniversary of `createdMs` strictly after `now` — new credit
 * plans reset monthly on the subscription day, so the anchor keeps the
 * subscription's UTC time-of-day, not a made-up midnight. The day clamps to
 * the target month's length (a 31st signup rolls to the 30th/28th).
 */
export declare function nextMonthlyAnniversary(createdMs: number, now: number): number;
/**
 * Query Ollama Cloud usage and return a normalised {@link OcQueryResult}.
 *
 * - No key → `not_configured`.
 * - Serves a cached result when fresh (< 10s).
 * - HTTP 401/403 → `auth_error` (bad or revoked key).
 * - Network/timeout/parse failure → `unavailable`.
 */
export declare function queryOcUsage(): Promise<OcQueryResult>;
export { clearCache, clearCache as clearOcCache } from "./cache.js";
export { fetchOcMe, fetchOcUsage, ME_URL, USAGE_URL } from "./client.js";
export { formatOcSection } from "./format.js";
export { loadApiKey, ENV_API_KEY } from "./config.js";
export type { OcQueryResult, OcUsageResponse } from "./types.js";
//# sourceMappingURL=index.d.ts.map