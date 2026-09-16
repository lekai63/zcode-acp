/**
 * In-memory TTL cache for Opencode Go results.
 *
 * Mirrors {@link ../../cache.ts} but typed for {@link GoQueryResult}. Same
 * 10s TTL — short enough that the countdown stays accurate in watch mode,
 * long enough to debounce rapid repeats. No file persistence, no sharding.
 */
import type { GoQueryResult } from "./types.js";
/** Return the cached result if still fresh, else `null`. */
export declare function getCached(): GoQueryResult | null;
/** Store a fresh result, stamping it with the current time. */
export declare function setCached(result: GoQueryResult): void;
/** Clear the cache (test helper, and used by CLI watch mode per tick). */
export declare function clearCache(): void;
/** Override the clock (test-only). Pass `undefined` to restore real time. */
export declare function setClock(fn?: () => number): void;
//# sourceMappingURL=cache.d.ts.map