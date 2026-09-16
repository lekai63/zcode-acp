/**
 * In-memory TTL cache for Opencode Go results.
 *
 * Mirrors {@link ../../cache.ts} but typed for {@link GoQueryResult}. Same
 * 10s TTL — short enough that the countdown stays accurate in watch mode,
 * long enough to debounce rapid repeats. No file persistence, no sharding.
 */
/** How long a cached result is served before re-querying. */
const TTL_MS = 10_000;
let slot = null;
/** Inject a fake clock — only tests should need this. */
let now = () => Date.now();
/** Return the cached result if still fresh, else `null`. */
export function getCached() {
    if (slot && now() - slot.at < TTL_MS)
        return slot.result;
    return null;
}
/** Store a fresh result, stamping it with the current time. */
export function setCached(result) {
    slot = { result, at: now() };
}
/** Clear the cache (test helper, and used by CLI watch mode per tick). */
export function clearCache() {
    slot = null;
}
/** Override the clock (test-only). Pass `undefined` to restore real time. */
export function setClock(fn) {
    now = fn ?? (() => Date.now());
}
//# sourceMappingURL=cache.js.map