/**
 * Opencode Go dashboard HTTP client.
 *
 * There is no JSON API for Go subscription usage. The only data source is the
 * authenticated web dashboard at `https://opencode.ai/workspace/<id>/go`,
 * which serves an HTML page with usage embedded in a SolidJS SSR hydration
 * payload. We fetch the HTML here and hand it to the parser.
 *
 * Credentials come from environment variables (set by the user) — not from
 * `~/.zcode/v2/config.json`, since Opencode Go is unrelated to the ZCode
 * provider the bridge talks to.
 */
/** Build the dashboard URL for a workspace. */
export declare function dashboardUrl(workspaceId: string): string;
/**
 * Fetch the Go dashboard HTML.
 *
 * @throws on non-2xx responses, network errors, or timeout. The caller maps
 *         these to `unavailable`. A redirect-to-login is NOT thrown here —
 *         the final URL is returned so the orchestrator can classify it as
 *         `auth_error`.
 */
export declare function fetchGoDashboard(workspaceId: string, authCookie: string, fetchImpl?: typeof globalThis.fetch): Promise<{
    status: number;
    text: string;
    finalUrl: string;
}>;
//# sourceMappingURL=client.d.ts.map