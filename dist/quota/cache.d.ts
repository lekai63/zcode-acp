/**
 * In-memory TTL cache for quota results.
 *
 * `/quota` is user-triggered, so the cache only guards against rapid repeats
 * (e.g. double-entering the command). The TTL is intentionally short — 10s —
 * so the displayed figures stay fresh while still debouncing bursts. There is
 * no file persistence and no per-key sharding: a single process-wide slot.
 */
import type { QuotaResult } from "./types.js";
/** Return the cached result if still fresh, else `null`. */
export declare function getCached(): QuotaResult | null;
/** Store a fresh result, stamping it with the current time. */
export declare function setCached(result: QuotaResult): void;
/** Clear the cache (test helper). */
export declare function clearCache(): void;
/** Override the clock (test-only). Pass `undefined` to restore real time. */
export declare function setClock(fn?: () => number): void;
//# sourceMappingURL=cache.d.ts.map