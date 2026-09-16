/**
 * GLM quota API HTTP client.
 *
 * Queries `bigmodel.cn` (CN) or `api.z.ai` (intl) for the current account's
 * usage limits. Credentials come from the active ZCode provider in
 * `~/.zcode/v2/config.json` via {@link loadZcodeCredentials} — the same apiKey
 * the backend already uses for model calls.
 */
/** Raw response from the quota endpoint, pre-parsing. */
export interface QuotaResponse {
    status: number;
    json: unknown;
    text: string;
}
/**
 * Pick the quota host from a provider `baseURL`.
 *
 * `api.z.ai` → intl; anything else (including `open.bigmodel.cn`,
 * `bigmodel.cn`, empty) → CN. This mirrors how the backend routes model
 * traffic.
 */
export declare function resolveQuotaHost(baseURL: string): string;
/**
 * Fetch the quota envelope from the GLM API.
 *
 * @throws if the active provider has no apiKey in config, or on network/timeout
 *         errors. The caller maps these to `unavailable`.
 */
export declare function fetchQuotaResponse(fetchImpl?: typeof globalThis.fetch): Promise<QuotaResponse>;
//# sourceMappingURL=client.d.ts.map