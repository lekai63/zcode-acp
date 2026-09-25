/**
 * Coding-plan quota reset cards.
 *
 * The desktop app exposes "reset cards" — a limited number of quota resets the
 * user can spend to clear a 5-hour or weekly window. This module is the headless
 * equivalent: the same four endpoints, the same headers, the same credentials,
 * so a client that cannot open the app still gets the feature.
 *
 * Credentials are the hard part. They live in `~/.zcode/v2/credentials.json`,
 * AES-256-GCM encrypted, keyed by `ZCODE_CREDENTIAL_SECRET` or a machine-bound
 * fallback string. Two tokens are needed and they are NOT interchangeable:
 *
 *  - `zcodejwttoken` → `Authorization: Bearer …`
 *  - the OAuth access token for the CURRENT provider family → `X-Bigmodel-Authorization`
 *
 * Picking the family correctly matters: a `zai`-only account has no bigmodel
 * token, and falling back across families would send a token the backend
 * rejects. The family is read from the provider id (`account:zai-…` vs
 * `account:bigmodel-…`), which is the same spelling the registry uses.
 *
 * Known limit: a TEAM plan's requests need `Bigmodel-Organization` /
 * `Bigmodel-Project` headers, and the ids are not in the credential store a
 * headless process can read. Team-plan resets therefore answer a backend error
 * rather than working; personal plans (the common case) are unaffected.
 *
 * This is the ONLY irreversible operation in the settings API. A spent card is
 * gone. `use()` therefore takes an idempotency key so a retry (a dropped
 * response, a double tap) cannot burn two cards, and the route layer requires a
 * fresh status nonce before it will call it.
 */
import { createDecipheriv, createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir, platform, userInfo } from "node:os";
import { log, zcodeCredentialsPath } from "../utils.js";
import { UpstreamError } from "./errors.js";
/** The only provider ids that own a coding plan. */
const CODING_PLAN_PROVIDER_PREFIX = "account:";
const ENCRYPTED_PREFIX = "enc:v1:";
const CIPHER_ALGORITHM = "aes-256-gcm";
const ZCODE_JWT_KEY = "zcodejwttoken";
const OAUTH_TOKEN_KEYS = {
    bigmodel: "oauth:bigmodel:access_token",
    zai: "oauth:zai:access_token",
};
/** The API origin; overridable for testing and for a self-hosted gateway. */
function apiOrigin(env = process.env) {
    return env.ZCODE_ENDPOINT_ORIGIN ?? env.ZCODE_BASE_URL ?? "https://zcode.z.ai";
}
const RESET_BASE_PATH = "/api/v1/coding-plan/reset";
const REQUEST_TIMEOUT_MS = 15_000;
/** Machine-bound fallback secret, mirroring ZCode's credential cipher. */
function resolveCredentialSecret(env) {
    const configured = env.ZCODE_CREDENTIAL_SECRET?.trim();
    if (configured)
        return configured;
    let username = "unknown";
    try {
        username = userInfo().username;
    }
    catch {
        /* sandboxed runtimes may not resolve it */
    }
    return `zcode-credential-fallback:${platform()}:${homedir()}:${username}`;
}
/**
 * Decrypt one `enc:v1:` credential value.
 *
 * The wire form is `enc:v1:<iv>.<authTag>.<ciphertext>`, all base64url. A value
 * without the prefix is returned as-is (plaintext entries exist in the wild).
 */
function decryptCredential(value, secret) {
    if (!value.startsWith(ENCRYPTED_PREFIX))
        return value;
    const payload = value.slice(ENCRYPTED_PREFIX.length);
    const parts = payload.split(".");
    if (parts.length !== 3)
        throw new Error("credential_decrypt_malformed");
    const [ivRaw, tagRaw, cipherRaw] = parts;
    const iv = Buffer.from(ivRaw, "base64url");
    const authTag = Buffer.from(tagRaw, "base64url");
    const cipherText = Buffer.from(cipherRaw, "base64url");
    const key = createHash("sha256").update(secret).digest();
    try {
        const decipher = createDecipheriv(CIPHER_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
    }
    catch {
        throw new Error("credentials_unavailable");
    }
}
/** Read and decrypt the credential store. Throws `credentials_unavailable`. */
async function loadCredentials(env) {
    let raw;
    try {
        raw = await readFile(zcodeCredentialsPath(), "utf8");
    }
    catch {
        throw new Error("credentials_unavailable");
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error("credentials_unavailable");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("credentials_unavailable");
    }
    const secret = resolveCredentialSecret(env);
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string")
            continue;
        try {
            out[key] = decryptCredential(value, secret);
        }
        catch (error) {
            // One undecryptable entry must not sink the rest — the store holds OAuth
            // discovery state and other unrelated secrets.
            log(`coding-plan: credential '${key}' could not be read (${error instanceof Error ? error.message : String(error)})`);
        }
    }
    return out;
}
/** Which family a provider id belongs to. */
export function resetFamilyFor(providerId) {
    return providerId.includes(":zai-") ? "zai" : "bigmodel";
}
/** True when the provider id can own a coding plan. */
export function isCodingPlanProvider(providerId) {
    if (!providerId.startsWith(CODING_PLAN_PROVIDER_PREFIX))
        return false;
    return /^account:(zai|bigmodel)-(individual|team)-coding-plan$/u.test(providerId);
}
/**
 * Resolve both tokens for a reset request.
 *
 * @throws `coding_plan_provider_required` for a non-account provider,
 *         `credentials_unavailable` when the store cannot be decrypted, and
 *         `coding_plan_<x>_jwt_required` when a token is missing.
 */
export async function resolveResetAuthorization(providerId, env = process.env) {
    if (!isCodingPlanProvider(providerId)) {
        throw new Error("coding_plan_provider_required");
    }
    const credentials = await loadCredentials(env);
    const zcodeJwt = credentials[ZCODE_JWT_KEY]?.trim();
    if (!zcodeJwt)
        throw new Error("coding_plan_zcode_jwt_required");
    const family = resetFamilyFor(providerId);
    const codingPlanJwt = credentials[OAUTH_TOKEN_KEYS[family]]?.trim();
    if (!codingPlanJwt)
        throw new Error("coding_plan_maas_jwt_required");
    return {
        zcodeAuthorization: /^Bearer\s/iu.test(zcodeJwt) ? zcodeJwt : `Bearer ${zcodeJwt}`,
        codingPlanAuthorization: codingPlanJwt,
    };
}
function resetHeaders(auth, includeScope) {
    const headers = {
        Authorization: auth.zcodeAuthorization,
        // The contract sends the MaaS JWT verbatim — no Bearer prefix.
        "X-Bigmodel-Authorization": auth.codingPlanAuthorization,
    };
    if (!includeScope)
        return headers;
    headers["Bigmodel-Target-Type"] = auth.teamContext ? "TEAM" : "PERSONAL";
    if (auth.teamContext) {
        headers["Bigmodel-Organization"] = auth.teamContext.organizationId;
        headers["Bigmodel-Project"] = auth.teamContext.projectId;
    }
    return headers;
}
/**
 * Read one reset endpoint, honouring its envelope contract.
 *
 * The backend reports business failures as `{code}` even on HTTP 4xx, so the
 * code — never the message — decides success. Codes the caller expects are
 * passed in so a "denied" answer can be surfaced as data instead of a throw.
 */
async function callReset(path, init, auth, acceptedCodes = [], fetchImpl = globalThis.fetch, env = process.env) {
    const response = await fetchImpl(`${apiOrigin(env)}${path}`, {
        method: init.method,
        headers: {
            ...resetHeaders(auth, init.includeScope),
            ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    let payload;
    try {
        payload = JSON.parse(await response.text());
    }
    catch {
        payload = null;
    }
    const envelope = (payload ?? {});
    if (typeof envelope.code === "number" && envelope.code !== 0) {
        if (acceptedCodes.includes(envelope.code))
            return envelope;
        throw new UpstreamError(`coding_plan_reset_api_error:${envelope.code}`);
    }
    if (!response.ok) {
        throw new UpstreamError(`coding_plan_reset_http_error:${response.status}`);
    }
    return envelope;
}
/** 3301 is the backend's "not now" answer for an opportunity request. */
const OPPORTUNITY_DENIED_CODE = 3301;
/** Fetch the current card inventory. */
export async function readResetStatus(providerId, fetchImpl = globalThis.fetch, env = process.env) {
    const auth = await resolveResetAuthorization(providerId, env);
    const envelope = (await callReset(`${RESET_BASE_PATH}/status`, { method: "GET", includeScope: true }, auth, [], fetchImpl, env));
    const data = envelope.data ?? {};
    const readList = (key) => {
        const value = data[key];
        if (!Array.isArray(value))
            return [];
        return value
            .filter((item) => typeof item === "object" &&
            item !== null &&
            typeof item.expire_at === "number")
            .map((item) => ({ expireAt: item.expire_at }));
    };
    const readHistory = (key) => {
        const value = data[key];
        if (typeof value !== "object" || value === null)
            return null;
        const usedAt = value.used_at;
        return typeof usedAt === "number" ? { usedAt } : null;
    };
    return {
        availableFiveHour: readList("available_five_hour_resets"),
        availableWeek: readList("available_week_resets"),
        latestFiveHour: readHistory("latest_five_hour_reset_history"),
        latestWeek: readHistory("latest_week_reset_history"),
        hasUnreadHistory: data["has_unread_history"] === true,
        nonce: randomUUID(),
    };
}
/**
 * Spend one card.
 *
 * The idempotency key is what makes a retry safe: the same key always answers
 * the same outcome instead of consuming a second card. The caller supplies it
 * (the route layer derives one per request), so a client that retries can
 * reuse the value it already sent.
 */
export async function useResetCard(providerId, resetType, idempotencyKey, fetchImpl = globalThis.fetch, env = process.env) {
    const key = idempotencyKey.trim();
    if (!key || key.length > 64)
        throw new Error("coding_plan_reset_invalid_idempotency_key");
    const auth = await resolveResetAuthorization(providerId, env);
    const envelope = (await callReset(`${RESET_BASE_PATH}/use`, {
        method: "POST",
        includeScope: true,
        body: { idempotency_key: key, reset_type: resetType },
    }, auth, [], fetchImpl, env));
    return { used: envelope.data?.used === true };
}
/**
 * Ask whether a reset would be granted right now.
 *
 * A denial (code 3301) is a normal answer carrying `next_try_at`, not a
 * failure — the UI shows a countdown rather than an error.
 */
export async function requestResetOpportunity(providerId, idempotencyKey, fetchImpl = globalThis.fetch, env = process.env) {
    const key = idempotencyKey.trim();
    if (!key || key.length > 64)
        throw new Error("coding_plan_reset_invalid_idempotency_key");
    const auth = await resolveResetAuthorization(providerId, env);
    const envelope = (await callReset(`${RESET_BASE_PATH}/opportunity`, { method: "POST", includeScope: true, body: { idempotency_key: key } }, auth, [OPPORTUNITY_DENIED_CODE], fetchImpl, env));
    if (envelope.code === OPPORTUNITY_DENIED_CODE) {
        const nextTryAt = envelope.data?.next_try_at;
        return { granted: false, nextTryAt: typeof nextTryAt === "number" ? nextTryAt : null };
    }
    return { granted: envelope.data?.granted === true, nextTryAt: null };
}
/** Mark the reset history read (clears the unread badge). */
export async function markResetHistoryRead(providerId, fetchImpl = globalThis.fetch, env = process.env) {
    const auth = await resolveResetAuthorization(providerId, env);
    // No target scope on this one: it validates identity but shares a read
    // cursor across the account.
    await callReset(`${RESET_BASE_PATH}/history/read`, { method: "POST", includeScope: false }, auth, [], fetchImpl, env);
}
/** Exposed for the eligibility check the route layer runs before any spend. */
export function codingPlanProviderIds() {
    // The registry spelling is the source of truth; these are the ids a coding
    // plan can be attached to, and only they may spend a card.
    return [
        "account:bigmodel-individual-coding-plan",
        "account:bigmodel-team-coding-plan",
        "account:zai-individual-coding-plan",
        "account:zai-team-coding-plan",
    ];
}
//# sourceMappingURL=coding-plan.js.map