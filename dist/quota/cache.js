/**
 * In-memory TTL cache for quota results.
 *
 * `/quota` is user-triggered, so the cache only guards against rapid repeats
 * (e.g. double-entering the command). The TTL is intentionally short — 10s —
 * so the displayed figures stay fresh while still debouncing bursts. There is
 * no file persistence and no per-key sharding: a single process-wide slot.
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
/** Clear the cache (test helper). */
export function clearCache() {
    slot = null;
}
/** Override the clock (test-only). Pass `undefined` to restore real time. */
export function setClock(fn) {
    now = fn ?? (() => Date.now());
}
//# sourceMappingURL=cache.js.map