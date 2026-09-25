/**
 * ZCode credential and environment handling.
 *
 * Vendored from the reference Python implementation so this package stays
 * self-contained. The ZCode desktop app stores provider credentials in
 * `~/.zcode/v2/config.json`; GUI-launched processes don't inherit shell env
 * vars, so we read the config and inject the active provider's settings into
 * the subprocess environment.
 */
import { readFileSync } from "node:fs";
import process from "node:process";
import { DEFAULT_MODEL_ID, providerSelectable } from "../config/options.js";
import { log, ZCODE_CREDS_PATH } from "../utils.js";
/** Read the active provider's credentials from config.json. Best-effort. */
export function loadZcodeCredentials() {
    try {
        const cfg = JSON.parse(readFileSync(ZCODE_CREDS_PATH, "utf8"));
        // ZCODE_PROVIDER pins the provider by id; unset keeps the historical
        // "first enabled provider wins" behaviour.
        const pinned = process.env.ZCODE_PROVIDER;
        for (const [providerId, p] of Object.entries(cfg.provider ?? {})) {
            // Mirror the model dropdown's providerSelectable rule (#183): a
            // keyless builtin provider (typical after plan upgrades in the App)
            // would inject an empty ANTHROPIC_API_KEY and every turn fails — skip
            // it in the default scan. Custom keyless providers stay selectable
            // when they are local or declare apiKeyRequired:false (ollama/
            // llama.cpp, #156). An explicit pin still honors the user's choice.
            if (!pinned && !providerSelectable(providerId, p))
                continue;
            if (p?.enabled && (!pinned || providerId === pinned)) {
                const opts = p.options ?? {};
                const models = p.models ?? {};
                return {
                    ZCODE_MODEL: Object.keys(models)[0] ?? DEFAULT_MODEL_ID,
                    providerBaseURL: opts.baseURL ?? "",
                    ANTHROPIC_API_KEY: opts.apiKey ?? "",
                };
            }
        }
    }
    catch (e) {
        log(`credentials: failed to read ${ZCODE_CREDS_PATH}: ${e instanceof Error ? e.message : String(e)}`);
    }
    return {};
}
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
export function mergeEnvWithCreds(creds) {
    const merged = { ...process.env, ...creds };
    delete merged.ZCODE_BASE_URL;
    for (const k of ["ZCODE_MODEL", "ANTHROPIC_API_KEY"]) {
        const v = process.env[k];
        if (v)
            merged[k] = v;
    }
    if (process.env.ZCODE_BASE_URL) {
        log(`credentials: dropped inherited ZCODE_BASE_URL='${process.env.ZCODE_BASE_URL}' — the ` +
            `app-server reads that variable as its service origin; model endpoints come from the provider registry.`);
    }
    return merged;
}
//# sourceMappingURL=credentials.js.map