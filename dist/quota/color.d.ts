/**
 * Color progress-bar rendering for the `zcode-acp quota` CLI.
 *
 * The default CLI view overlays the usage numbers directly onto a heat-colored
 * (green→yellow→red) bar using 24-bit ANSI background colors, so the percentage
 * or used/total counter reads from inside the bar and the right margin stays
 * short (just the reset time). `--plain` and the `/quota` slash command bypass
 * this module entirely and keep the classic monochrome `█`/`░` layout from
 * {@link renderBar}.
 *
 * Only real terminals render 24-bit color; the CLI caller gates this on
 * `process.stdout.isTTY` so piping to a file or another command never emits
 * raw escape codes.
 */
/** ANSI reset (cancel all attributes). */
export declare const RESET = "\u001B[0m";
/** 24-bit RGB triple. */
type Rgb = readonly [number, number, number];
/**
 * Green→yellow→red heat color for a usage percent.
 *
 * 0% → green `(34,197,94)`, 50% → yellow `(234,179,8)`, 100% → red
 * `(239,68,68)`, piecewise-linearly interpolated. Input is clamped to [0, 100].
 */
export declare function heatColor(pct: number): Rgb;
/**
 * Pick the overlay text drawn inside the bar.
 *
 * Returns `"used/total"` when the item carries both absolute counters (e.g. the
 * MCP limit), otherwise the used percent. GLM percents are integers at parse
 * time; Opencode Go reports 0.1 steps, so one fractional digit is kept instead
 * of rounding the precision away (`84.3%`, not `84%`).
 */
export declare function pickOverlay(item: {
    usedPercent: number;
    usedCount?: number;
    totalCount?: number;
}): string;
/** Options for {@link renderColorBar}. */
export interface ColorBarOptions {
    /** Text drawn centered inside the bar (e.g. `"73%"` or `"237/1000"`). */
    overlay?: string;
    /** Total cell count; defaults to 20 to match the plain {@link renderBar}. */
    width?: number;
}
/**
 * Render a heat-colored progress bar with optional centered overlay text.
 *
 * Each cell is one background color: the fill cells use {@link heatColor} (so
 * low usage reads green, high usage red), the empty cells use a constant dark
 * gray. When an overlay string is supplied its characters are written over the
 * bar with a contrasting foreground (white on fill, gray on empty), centered
 * across the `width` cells. The result always ends with {@link RESET} so the
 * color never leaks into the text that follows.
 */
export declare function renderColorBar(usedPercent: number, opts?: ColorBarOptions): string;
export {};
//# sourceMappingURL=color.d.ts.map