/**
 * Quota response parsing — turns the raw GLM `limits[]` array into a flat list
 * of normalised {@link QuotaItem}s.
 *
 * Design goals (vs. the reference project):
 *   - **No hardcoded type whitelist.** Unknown `type` values still render,
 *     labelled by their raw type string, so future windows surface
 *     automatically.
 *   - **Percentage fallback chain** that tolerates inconsistent field sets
 *     across limit kinds (some carry absolute counters, some only a legacy
 *     `percentage`).
 *   - **Labels derived from `type` + `number`**, without magic-number coupling.
 */
import type { QuotaItem, QuotaResult, RawLimit } from "./types.js";
/**
 * Parse one raw limit into a {@link QuotaItem}, or `null` if no percentage
 * can be computed (the limit is then dropped from display).
 */
export declare function parseLimit(limit: RawLimit): QuotaItem | null;
/**
 * Parse the full API response (already classified by the fetch layer as a
 * `response` with a status + body) into a {@link QuotaResult}.
 *
 * State machine: 429/rate-limit text → `rate_limited`; auth codes/text →
 * `auth_error`; success with zero parseable items → `unavailable`; otherwise
 * the items are returned in original order.
 */
export declare function parseQuotaEnvelope(envelope: {
    status: number;
    json: unknown;
    text: string;
}): QuotaResult;
//# sourceMappingURL=parse.d.ts.map