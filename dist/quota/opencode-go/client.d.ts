/**
 * Opencode Go status HTTP client.
 *
 * The Go dashboard moved off the legacy SSR page (`/workspace/<id>/go` — that
 * URL now bounces EVERY cookie to the login page, observed 2026-09-19) onto
 * the console at `https://opencode.ai/console/<org>/go`, backed by this JSON
 * API. Usage arrives as micro-cents meter pairs per window; the parser turns
 * them into percent + countdown.
 *
 * Auth needs THREE pieces (verified against the live API 2026-09-19): the
 * `auth` cookie, the `__Host-console_session` cookie, and the `x-org-id`
 * header. Missing session cookie → 401, missing org header → 400; any
 * User-Agent works (one is sent for parity with the console's own requests).
 */
/** The console status API endpoint (the org rides the `x-org-id` header). */
export declare function goStatusUrl(): string;
/**
 * Fetch the Go status JSON.
 *
 * @throws on network errors or timeout; the caller maps these to
 *         `unavailable`. Auth failures are NOT thrown here — the HTTP status
 *         is returned so the orchestrator can classify 400/401/403 as
 *         `auth_error`.
 */
export declare function fetchGoStatus(workspaceId: string, authCookie: string, sessionToken: string, fetchImpl?: typeof globalThis.fetch): Promise<{
    status: number;
    text: string;
}>;
//# sourceMappingURL=client.d.ts.map