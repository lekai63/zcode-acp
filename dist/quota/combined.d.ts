/**
 * Combined multi-provider quota — the orchestration layer used by the
 * `zcode-acp quota` CLI when no provider subcommand is given (default mode).
 *
 * Queries GLM Coding Plan and Opencode Go in parallel and renders a single
 * merged card with one section per provider. The `/quota` slash command does
 * NOT use this — it stays on the single-provider GLM {@link formatQuota}.
 *
 * Design notes:
 *   - `Promise.all` so a slow Opencode Go scrape doesn't delay the GLM card.
 *   - A `not_configured` Opencode Go result is silently dropped (no header,
 *     no error line) in `all` mode, so GLM-only users see no noise. In `go`
 *     mode it surfaces as a help line because the user explicitly asked.
 *   - The divider width is computed from the widest body line so the frame
 *     stays balanced regardless of which windows/counts are present.
 */
import type { FormatOptions } from "./format.js";
import type { GoQueryResult, GoWindowKey } from "./opencode-go/types.js";
import type { QuotaResult } from "./types.js";
/** Which provider(s) to query. */
export type Provider = "all" | "glm" | "go";
/** The combined result of both providers. */
export interface CombinedResult {
    glm: QuotaResult;
    go: GoQueryResult;
}
/**
 * Which Opencode Go windows to render. All three (rolling + weekly + monthly)
 * are shown in every mode that renders Go at all — the compact color layout
 * leaves room for the monthly bar.
 */
export declare function defaultGoWindows(provider: Provider): GoWindowKey[];
/**
 * Query both providers in parallel.
 *
 * Each provider degrades internally (GLM → `unavailable`, Go →
 * `not_configured`/`unavailable`); neither ever throws, so `Promise.all`
 * always resolves.
 */
export declare function queryCombined(provider: Provider): Promise<CombinedResult>;
/**
 * Render the combined result as a single fenced ```text card.
 *
 * Sections are separated by a blank line; each section has a ` Header` line
 * (indented one space so it reads as a sub-heading) followed by its body.
 * The divider spans the widest line in the card.
 */
export declare function formatCombinedCard(combined: CombinedResult, opts?: {
    provider: Provider;
    glm?: FormatOptions;
    goWindows?: GoWindowKey[];
    /** Render heat-colored 24-bit ANSI bars with overlaid numbers. */
    color?: boolean;
    /** Optional trailing annotation appended to the first section header
     *  (e.g. ` · refresh in 29s`). Watch mode uses it to show the countdown. */
    refreshSuffix?: string;
}): string;
/** {@link formatCombinedCard} without the fence — for raw terminal output. */
export declare function formatCombinedCardPlain(combined: CombinedResult, opts?: {
    provider: Provider;
    glm?: FormatOptions;
    goWindows?: GoWindowKey[];
    color?: boolean;
    refreshSuffix?: string;
}): string;
//# sourceMappingURL=combined.d.ts.map