/**
 * Quota orchestration — the single entry point used by the `/quota` slash
 * command.
 *
 * Flow: cache check → fetch → parse → cache write. Any thrown error (missing
 * apiKey, network/timeout) degrades to `unavailable` rather than propagating,
 * so the command always produces a user-visible message.
 */
import type { QuotaResult } from "./types.js";
/**
 * Query the GLM quota API and return a normalised {@link QuotaResult}.
 *
 * Serves a cached result when fresh (< 10s). On fetch failure the result is
 * `unavailable`; on a successful fetch the parsed envelope is cached and
 * returned.
 */
export declare function queryQuota(): Promise<QuotaResult>;
export { formatQuota, formatQuotaPlain } from "./format.js";
export { parseLimit, parseQuotaEnvelope } from "./parse.js";
export { renderBar } from "./format.js";
export type { FormatOptions } from "./format.js";
export type { QuotaItem, QuotaResult, RawLimit } from "./types.js";
//# sourceMappingURL=index.d.ts.map