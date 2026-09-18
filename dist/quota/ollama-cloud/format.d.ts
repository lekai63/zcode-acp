/**
 * Ollama Cloud usage formatting.
 *
 * Renders the plan's usage windows as progress bars in the same style as the
 * GLM and Opencode Go sections, so all sections read as one card in the
 * combined view. Which windows exist depends on the account's plan: legacy
 * plans expose session (5h) + weekly; current credit plans expose monthly.
 * The API exposes no reset timestamps, so the reset moments are derived at
 * query time (window anchoring, or /api/me's billing period for monthly) and
 * rendered as the same `MM-DD HH:MM` trailing stamp the other providers use —
 * absent when the monthly lookup fails.
 */
import type { OcQueryResult } from "./types.js";
/** A rendered section: a header line and zero or more body lines. */
export interface RenderedSection {
    header: string;
    body: string[];
}
/**
 * Render the Ollama Cloud section.
 *
 * Used by the combined formatter. The header is always `Ollama Cloud`; body
 * has one bar line per window. Non-success kinds return a header + a single
 * explanatory line.
 *
 * When `color` is true the bar is a heat-colored 24-bit ANSI bar with the
 * percent overlaid inside, mirroring the other providers' color layout.
 */
export declare function formatOcSection(result: OcQueryResult, color?: boolean): RenderedSection;
//# sourceMappingURL=format.d.ts.map