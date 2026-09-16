/**
 * ZCode credential and environment handling.
 *
 * Vendored from the reference Python implementation so this package stays
 * self-contained. The ZCode desktop app stores provider credentials in
 * `~/.zcode/v2/config.json`; GUI-launched processes don't inherit shell env
 * vars, so we read the config and inject the active provider's settings into
 * the subprocess environment.
 */
/** The enabled provider selected from config.json. */
export interface ActiveProvider {
    id: string;
    name: string;
    kind: string;
    baseURL: string;
    modelId: string;
    apiKey: string;
}
/** Credentials extracted from the active provider. */
export interface ZcodeCredentials {
    ZCODE_MODEL?: string;
    ZCODE_BASE_URL?: string;
    ANTHROPIC_API_KEY?: string;
}
/**
 * Select the active provider from config.json.
 *
 * `ZCODE_PROVIDER` pins the provider by id; unset keeps the historical
 * "first enabled provider wins" behaviour.
 */
export declare function loadActiveProvider(): ActiveProvider | undefined;
/** Read the active provider's credentials from config.json. Best-effort. */
export declare function loadZcodeCredentials(): ZcodeCredentials;
/**
 * Merge process.env with config credentials.
 *
 * `ZCODE_BASE_URL` is overloaded by the ZCode CLI: `parseEnvConfig` reads it as
 * the model provider baseURL, while `resolveRuntimeZCodeEndpointOrigin` reads
 * its **origin** as the ZCode endpoint — the host serving
 * `/api/v1/agent/configs`, which carries `codingPlanSignature.enable` and the
 * `proxyEndpoint` routing map. Those are different hosts: the endpoint is
 * `https://zcode.z.ai`, the provider baseURL is e.g.
 * `https://open.bigmodel.cn/api/anthropic`.
 *
 * Passing the provider baseURL through `ZCODE_BASE_URL` collapses the two: the
 * CLI fetches `<provider-host>/api/v1/agent/configs`, gets a 404, and never
 * enables request signing nor learns the endpoint routing map. Requests then go
 * out unsigned, straight to the provider, and the coding-plan discount is lost.
 *
 * Publish the provider into the CLI's own config (`~/.zcode/cli/config.json`)
 * instead, and drop the config-derived `ZCODE_BASE_URL` so the endpoint origin
 * falls back to the production default. An explicit `ZCODE_BASE_URL` in
 * `process.env` is left alone — it is the caller's override.
 */
export declare function mergeEnvWithCreds(creds: ZcodeCredentials): NodeJS.ProcessEnv;
//# sourceMappingURL=credentials.d.ts.map