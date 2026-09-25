/**
 * Type definitions for the Opencode Go subscription usage feature.
 *
 * `zcode-acp quota` queries the console status API
 * (`https://opencode.ai/console/api/go/status`, JSON — since the 2026-09
 * console migration replaced the scraped `/workspace/<id>/go` SSR page).
 * Usage is split into three windows: rolling (5h), weekly (7d), monthly
 * (30d). The API serves micro-cents meter pairs; the parser computes each
 * window's `usagePercent` and relative `resetInSec` countdown.
 */
export {};
//# sourceMappingURL=types.js.map