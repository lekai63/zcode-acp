/**
 * Quota result formatting — renders a {@link QuotaResult} as a multi-line
 * plain-text card inside a ```text fenced block.
 *
 * The whole card is wrapped in a fenced code block so the editor renders it in
 * a monospace, bordered, copy-able frame. Monospace also normalises the block
 * element widths (▓/░ are NOT marked East-Asian-Wide, but some proportional
 * chat fonts stretch them; a code frame guarantees 1-cell-per-bar).
 *
 * The progress bar uses two block characters at {@link BAR_WIDTH}-cell width
 * for a clean, precise fill (each cell = 5%):
 *   █ (U+2588, full block) — used portion
 *   ░ (U+2591, light shade) — remaining portion
 * Inside a monospace code block the full-block reads as a solid, high-impact
 * fill for used quota, with the light shade marking the remainder.
 */
import type { OcQueryResult } from "./ollama-cloud/types.js";
import type { GoQueryResult } from "./opencode-go/types.js";
import type { QuotaResult } from "./types.js";
/**
 * Render a {@link BAR_WIDTH}-cell progress bar for a used-percent in [0, 100].
 *
 * 0% → all empty; 100% → all full; otherwise the used portion is `█` and the
 * rest is `░`, rounded to the nearest cell (each cell = 10%).
 */
export declare function renderBar(usedPercent: number): string;
/**
 * Format a reset timestamp (ms) as a local `MM-DD HH:MM` string, or `null`.
 *
 * Exported so the Opencode Go formatter can reuse the same layout (Go windows
 * carry only a relative `resetInSec`; the caller converts that to an absolute
 * ms timestamp against the fetch snapshot first).
 */
export declare function formatResetTime(nextResetTime?: number): string | null;
/**
 * Options controlling which sections of the card are rendered.
 *
 * - `detail` (default `true`): show per-model usage breakdown sub-lines
 *   (`├ search-prime …`). Set to `false` for compact terminal output where the
 *   aggregate bar is enough.
 * - `compact` (default `false`): collapse the MCP item into a trailing
 *   annotation on the 5h line (`· MCP (used/total)`) and drop its standalone
 *   bar line + detail sub-lines. Used only by the combined dual-provider CLI
 *   view to keep the merged card short; the standalone `glm` subcommand and
 *   the `/quota` slash command keep the full layout.
 * - `color` (default `false`): render the bar as a heat-colored (green→red)
 *   24-bit ANSI bar with the usage numbers overlaid inside (see
 *   {@link pickOverlay}), leaving only the reset time on the right margin.
 *   Only the `zcode-acp quota` CLI sets this (gated on `stdout.isTTY`); the
 *   `/quota` slash command never does, so its fenced ```text card stays plain
 *   and copy-paste-safe.
 */
export interface FormatOptions {
    detail?: boolean;
    compact?: boolean;
    color?: boolean;
}
/**
 * A rendered GLM section — a header (plan name) and the bar lines.
 *
 * Exported so the combined CLI view can compose the GLM section alongside the
 * Opencode Go section inside one card, without duplicating the per-item
 * formatting logic.
 */
export interface RenderedGlmSection {
    header: string;
    body: string[];
}
/**
 * Render the GLM section (header + one bar line per item) without the fence
 * or divider.
 *
 * Non-success kinds return a header of `"GLM Coding Plan"` and a single
 * explanatory body line, mirroring {@link formatQuota}'s non-success prose
 * (just split into header/body for composability).
 *
 * In `compact` mode the MCP item is collapsed into a trailing annotation on
 * the 5h line (`· MCP (used/total)`) and its own bar line + detail sub-lines
 * are dropped — used by the combined dual-provider CLI view to keep the merged
 * card short. The standalone `glm` subcommand and `/quota` slash command use
 * the full layout.
 */
export declare function renderGlmSection(result: QuotaResult, opts?: FormatOptions): RenderedGlmSection;
/**
 * Render a {@link QuotaResult} as a multi-line plain-text card wrapped in a
 * ```text fenced block.
 *
 * The fence makes the editor render the card in a monospace, bordered, copy-
 * able frame — without it the proportional chat font mangles block-element
 * widths (▓/░ render at different glyph advances and can look stretched), and
 * the divider/bars lose their alignment.
 *
 * Success → header line + divider + one progress-bar line per item (plus
 * indented per-model detail where present). Non-success kinds → a single
 * explanatory line, unfenced (they are short prose, not a card).
 */
export declare function formatQuota(result: QuotaResult, opts?: FormatOptions): string;
/**
 * {@link formatQuota} without the ```text fence — for raw terminal output.
 *
 * The fence is only useful inside an editor chat frame (where it triggers a
 * bordered, copy-able code block). A real terminal renders the fence as
 * literal ```` ``` ```` characters, so the standalone CLI strips it.
 * Non-success kinds are already unfenced short prose, returned unchanged.
 */
export declare function formatQuotaPlain(result: QuotaResult, opts?: FormatOptions): string;
/**
 * Format a compact one-line quota string for the Martty TUI's resident dock
 * (ADR-0021): `45% 14:23 · 12% 10-18 · go 8% 10-11` — each window's used
 * percent with its reset moment inline (clock time for the 5h window, date for
 * weekly/monthly). MCP quota
 * is deliberately omitted (the dock line must stay short).
 *
 * Returns `null` when there is nothing to show (non-success result, or a
 * success with no 5h/weekly windows) so the caller hides the dock instead of
 * rendering a placeholder.
 */
export declare function formatQuotaDock(result: QuotaResult): string | null;
/**
 * Compact Opencode Go segment for the dock: monthly window only, as
 * `go 8% 10-11` — percent plus the reset DATE (the monthly window resets in
 * ~30d, so a clock time is meaningless; the date is computed from the fetch
 * time + relative countdown). `null` when Go is not usable (not configured,
 * auth error, unavailable, or no monthly window exposed by the dashboard).
 */
export declare function formatGoDockSegment(go: GoQueryResult): string | null;
/**
 * Compact Ollama Cloud segment for the dock, showing ONLY the largest window
 * the plan exposes — monthly for credit plans, else weekly, else the 5h
 * session — as `oc 60.3% 10-11`: percent at one-decimal precision plus the
 * derived reset stamp (clock time for 5h, date for weekly/monthly; omitted
 * when the monthly /api/me lookup failed). The window label is deliberately
 * omitted: it is constant per plan and the reset stamp already tells the
 * windows apart. `null` when Ollama is not usable (not configured, auth
 * error, unavailable, or no windows).
 */
export declare function formatOcDockSegment(oc: OcQueryResult): string | null;
/** Join the dock segments; `null` when all are absent. */
export declare function composeQuotaDock(...segments: (string | null)[]): string | null;
//# sourceMappingURL=format.d.ts.map