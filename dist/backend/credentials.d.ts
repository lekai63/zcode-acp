/**
 * ZCode credential and environment handling.
 *
 * Vendored from the reference Python implementation so this package stays
 * self-contained. The ZCode desktop app stores provider credentials in
 * `~/.zcode/v2/config.json`; GUI-launched processes don't inherit shell env
 * vars, so we read the config and inject the active provider's settings into
 * the subprocess environment.
 */
/** Credentials extracted from the active provider. */
export interface ZcodeCredentials {
    ZCODE_MODEL?: string;
    ANTHROPIC_API_KEY?: string;
    /**
     * The active provider's model endpoint, for in-process consumers only (the
     * quota host pick). Deliberately NOT exported into the subprocess
     * environment: the app-server reads `ZCODE_BASE_URL` FIRST when resolving
     * its own service origin (configuration, signing and billing endpoints), so
     * a model URL in that variable would send those requests to the provider
     * host. Model endpoints reach the app-server through the provider registry
     * (see `builtinProviderEnv`), never through the environment.
     */
    providerBaseURL?: string;
}
/** Read the active provider's credentials from config.json. Best-effort. */
export declare function loadZcodeCredentials(): ZcodeCredentials;
/**
 * Merge process.env with config credentials.
 *
 * Explicit non-empty env vars override config (so `ZCODE_MODEL=foo` works as a
 * temporary override). Empty-string env vars are treated as unset so they
 * don't clobber the config value.
 *
 * `ZCODE_BASE_URL` is always removed from the result: the app-server resolves
 * its service origin as `ZCODE_BASE_URL ?? ZCODE_ENDPOINT_ORIGIN ?? <built-in
 * production default>`, so a provider model URL in that variable — from this
 * bridge's historical injection or an inherited shell variable — would send
 * the app-server's configuration/signing/billing requests to the provider
 * host, where they fail (`invalid_schema`), client signing falls back to
 * disabled, and every model request leaves unsigned. With the variable unset,
 * the app-server uses the same built-in default origin as a desktop-launched
 * session.
 */
export declare function mergeEnvWithCreds(creds: ZcodeCredentials): NodeJS.ProcessEnv;
//# sourceMappingURL=credentials.d.ts.map