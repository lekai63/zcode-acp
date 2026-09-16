/**
 * Opencode Go usage formatting.
 *
 * Renders the three windows (rolling 5h / weekly 7d / monthly 30d) as progress
 * bars identical in style to the GLM card, so the two sections read as one
 * cohesive card in the combined view. Reuses {@link renderBar} from the GLM
 * formatter for visual consistency.
 */
import type { GoQueryResult, GoWindowKey } from "./types.js";
/**
 * Format a duration in seconds as a compact countdown.
 *
 * - `>= 1d`  → `Xd Yh` (e.g. `6d 8h`)
 * - `>= 1h`  → `Yh Zm` (e.g. `2h 30m`)
 * - `>= 1m`  → `Zm`    (e.g. `45m`)
 * - `< 1m`   → `<1m`
 */
export declare function formatDuration(sec: number): string;
/** A rendered section: a header line and zero or more body lines. */
export interface RenderedSection {
    header: string;
    body: string[];
}
/**
 * Render the Opencode Go section for the requested windows.
 *
 * Used by the combined formatter. The header is always `Opencode Go`; body
 * has one bar line per window. Non-success kinds return a header + a single
 * explanatory line.
 *
 * When `color` is true the bar is a heat-colored 24-bit ANSI bar with the
 * percent overlaid inside (Go windows carry no absolute counters, so the
 * overlay is always `NN%`), mirroring the GLM color layout.
 */
export declare function formatGoSection(result: GoQueryResult, windows: readonly GoWindowKey[], now?: number, color?: boolean): RenderedSection;
//# sourceMappingURL=format.d.ts.map