/**
 * Type definitions for the Opencode Go subscription usage feature.
 *
 * The `zcode-acp quota` CLI queries the opencode.ai web dashboard (there is no
 * JSON API yet) by scraping the SolidJS SSR hydration payload embedded in
 * `https://opencode.ai/workspace/<id>/go`. Usage is split into three windows:
 * rolling (5h), weekly (7d), monthly (30d). Each window carries only a
 * server-provided `usagePercent` and a relative `resetInSec` countdown.
 */
export {};
//# sourceMappingURL=types.js.map