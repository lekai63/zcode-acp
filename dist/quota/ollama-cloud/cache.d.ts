/**
 * In-memory TTL cache for Ollama Cloud results.
 *
 * Mirrors {@link ../../cache.ts} but typed for {@link OcQueryResult}. Same
 * 10s TTL — matches the quota cache and the CLI's minimum watch interval.
 */
import type { OcQueryResult } from "./types.js";
/** Return the cached result if still fresh, else `null`. */
export declare function getCached(): OcQueryResult | null;
/** Store a fresh result, stamping it with the current time. */
export declare function setCached(result: OcQueryResult): void;
/** Clear the cache (test helper, and used by CLI watch mode per tick). */
export declare function clearCache(): void;
/** Override the clock (test-only). Pass `undefined` to restore real time. */
export declare function setClock(fn?: () => number): void;
//# sourceMappingURL=cache.d.ts.map