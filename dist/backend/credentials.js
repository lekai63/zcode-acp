/**
 * ZCode credential and environment handling.
 *
 * Vendored from the reference Python implementation so this package stays
 * self-contained. The ZCode desktop app stores provider credentials in
 * `~/.zcode/v2/config.json`; GUI-launched processes don't inherit shell env
 * vars, so we read the config and inject the active provider's settings into
 * the subprocess environment.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { DEFAULT_MODEL_ID } from "../config/options.js";
import { log, ZCODE_CREDS_PATH } from "../utils.js";
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Select the active provider from config.json.
 *
 * `ZCODE_PROVIDER` pins the provider by id; unset keeps the historical
 * "first enabled provider wins" behaviour.
 */
export function loadActiveProvider() {
    try {
        const cfg = JSON.parse(readFileSync(ZCODE_CREDS_PATH, "utf8"));
        const pinned = process.env.ZCODE_PROVIDER;
        for (const [id, p] of Object.entries(cfg.provider ?? {})) {
            if (p?.enabled && (!pinned || id === pinned)) {
                const opts = p.options ?? {};
                return {
                    id,
                    name: p.name?.trim() || id,
                    kind: p.kind?.trim() || "anthropic",
                    baseURL: opts.baseURL ?? "",
                    modelId: Object.keys(p.models ?? {})[0] ?? DEFAULT_MODEL_ID,
                    apiKey: opts.apiKey ?? "",
                };
            }
        }
    }
    catch (e) {
        log(`credentials: failed to read ${ZCODE_CREDS_PATH}: ${e instanceof Error ? e.message : String(e)}`);
    }
    return undefined;
}
/** Read the active provider's credentials from config.json. Best-effort. */
export function loadZcodeCredentials() {
    const provider = loadActiveProvider();
    if (!provider)
        return {};
    return {
        ZCODE_MODEL: provider.modelId,
        ZCODE_BASE_URL: provider.baseURL,
        ANTHROPIC_API_KEY: provider.apiKey,
    };
}
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
export function mergeEnvWithCreds(creds) {
    const merged = { ...process.env, ...creds };
    for (const k of ["ZCODE_MODEL", "ZCODE_BASE_URL", "ANTHROPIC_API_KEY"]) {
        const v = process.env[k];
        if (v)
            merged[k] = v;
    }
    const explicitBaseUrl = Boolean(process.env.ZCODE_BASE_URL);
    const provider = loadActiveProvider();
    let published = false;
    if (provider?.baseURL) {
        try {
            published = publishProviderToCliConfig(provider);
        }
        catch (e) {
            log(`credentials: failed to write ZCode CLI provider config: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    // Only the config-derived value is dropped; a caller-set ZCODE_BASE_URL stays.
    if (published && !explicitBaseUrl)
        delete merged.ZCODE_BASE_URL;
    return merged;
}
/** Absolute path of the ZCode CLI user config (`~/.zcode/cli/config.json`). */
function cliConfigPath() {
    const home = process.env.HOME || process.env.USERPROFILE || homedir();
    return path.join(home, ".zcode", "cli", "config.json");
}
/**
 * Merge the active provider into the ZCode CLI config so the CLI resolves the
 * provider baseURL without us having to overwrite `ZCODE_BASE_URL`.
 *
 * Existing keys are preserved; the default `model` is only set when the CLI
 * config does not already select one. Returns false when nothing changed.
 */
function publishProviderToCliConfig(provider) {
    const file = cliConfigPath();
    let config = {};
    try {
        const parsed = JSON.parse(readFileSync(file, "utf8"));
        if (isPlainObject(parsed))
            config = parsed;
    }
    catch {
        // missing or unreadable — start from a fresh object
    }
    const providers = isPlainObject(config.provider)
        ? { ...config.provider }
        : {};
    const existingRaw = providers[provider.id];
    const existing = isPlainObject(existingRaw) ? existingRaw : {};
    const options = isPlainObject(existing.options)
        ? { ...existing.options }
        : {};
    options.baseURL = provider.baseURL;
    providers[provider.id] = {
        ...existing,
        kind: typeof existing.kind === "string" && existing.kind.trim() ? existing.kind : provider.kind,
        name: typeof existing.name === "string" && existing.name.trim() ? existing.name : provider.name,
        options,
    };
    const next = { ...config, provider: providers };
    const hasModel = (typeof config.model === "string" && config.model.trim().length > 0) ||
        (isPlainObject(config.model) &&
            (config.model.main !== undefined || config.model.lite !== undefined));
    if (!hasModel)
        next.model = `${provider.id}/${provider.modelId}`;
    const serialized = `${JSON.stringify(next, null, 2)}\n`;
    let current = null;
    try {
        current = readFileSync(file, "utf8");
    }
    catch {
        // no existing file
    }
    if (current === serialized)
        return true;
    mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, serialized, { mode: 0o600 });
    renameSync(tmp, file);
    return true;
}
//# sourceMappingURL=credentials.js.map