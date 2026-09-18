/**
 * Ollama Cloud usage HTTP client.
 *
 * Talks to `https://ollama.com/api/usage` — an undocumented but live endpoint
 * that returns `{limits:{session:{usage},weekly:{usage}}}` with usage as a
 * 0..1 fraction. Auth is a plain Bearer API key (docs.ollama.com). No
 * rate-limit headers exist on any Ollama endpoint, so the body is the only
 * data source.
 */
/** The undocumented usage endpoint (verified live 2026-09). */
export declare const USAGE_URL = "https://ollama.com/api/usage";
/**
 * Fetch the usage JSON body.
 *
 * @throws on network errors or timeout. The caller maps these to
 *         `unavailable`. Auth failures are NOT thrown — the status is
 *         returned so the orchestrator can classify 401/403 as `auth_error`.
 */
export declare function fetchOcUsage(apiKey: string, fetchImpl?: typeof globalThis.fetch): Promise<{
    status: number;
    text: string;
}>;
/** The undocumented account-status endpoint (verified live 2026-09). */
export declare const ME_URL = "https://ollama.com/api/me";
/**
 * Fetch the account-status JSON body (plan tier, subscription period end,
 * suspended flag) — the only source for the monthly billing-period reset.
 *
 * Same contract as {@link fetchOcUsage}: throws on network errors/timeout,
 * returns the status so the caller classifies 401/403.
 */
export declare function fetchOcMe(apiKey: string, fetchImpl?: typeof globalThis.fetch): Promise<{
    status: number;
    text: string;
}>;
//# sourceMappingURL=client.d.ts.map