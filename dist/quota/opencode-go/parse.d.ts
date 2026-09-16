/**
 * Opencode Go dashboard HTML parser.
 *
 * The dashboard is a SolidJS SSR page. Usage data is embedded as hydration
 * assignments inside a `<script>`, in the shape:
 *
 *   rollingUsage:$R[N]={usagePercent:<n>,resetInSec:<n>}
 *
 * (field order may vary; `$R[N]` is a Solid hydration reference). This is JS
 * source, not JSON, so we extract with regexes rather than `JSON.parse`. Two
 * independent reference implementations (pi-go-bars, @beyona/pi-zai-usage)
 * use the same approach as of 2026-08, but the format has no stability
 * contract — a frontend change will silently break extraction, which is why
 * {@link looksLikeDashboard} guards against parser rot.
 */
import type { GoWindow } from "./types.js";
/**
 * Detect whether the HTML is a dashboard page (vs. a login redirect or error
 * page). Used to distinguish "parser is outdated" from "no windows present".
 */
export declare function looksLikeDashboard(html: string): boolean;
/** Result of parsing the dashboard — each window is independently optional. */
export interface ParsedGoDashboard {
    rolling: GoWindow | null;
    weekly: GoWindow | null;
    monthly: GoWindow | null;
    /**
     * Set when the HTML looks like a dashboard but no windows parsed — the SSR
     * format likely changed. The caller surfaces this as `unavailable`.
     */
    parserOutdated: boolean;
}
/**
 * Parse the dashboard HTML into the three windows.
 *
 * `parserOutdated` is true when the page looks like a dashboard (contains the
 * window variable names) but none of the three windows matched — signalling
 * that the SolidJS hydration format has drifted.
 */
export declare function parseGoDashboard(html: string): ParsedGoDashboard;
//# sourceMappingURL=parse.d.ts.map