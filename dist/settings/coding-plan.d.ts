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
export type ResetFamily = "zai" | "bigmodel";
export type ResetType = "FIVE_HOUR" | "WEEK";
export interface ResetCardStatus {
    /** Cards still available, with their expiry (epoch ms). */
    availableFiveHour: Array<{
        expireAt: number;
    }>;
    availableWeek: Array<{
        expireAt: number;
    }>;
    latestFiveHour: {
        usedAt: number;
    } | null;
    latestWeek: {
        usedAt: number;
    } | null;
    hasUnreadHistory: boolean;
    /**
     * Opaque token the client must send back with `use()`. Ties a spend to a
     * status read made moments earlier, so a stale screen cannot consume a card
     * the user has already seen change.
     */
    nonce: string;
}
export interface ResetAuthorization {
    zcodeAuthorization: string;
    codingPlanAuthorization: string;
    /** Present for team plans; absent for personal ones. */
    teamContext?: {
        organizationId: string;
        projectId: string;
    };
}
/** Which family a provider id belongs to. */
export declare function resetFamilyFor(providerId: string): ResetFamily;
/** True when the provider id can own a coding plan. */
export declare function isCodingPlanProvider(providerId: string): boolean;
/**
 * Resolve both tokens for a reset request.
 *
 * @throws `coding_plan_provider_required` for a non-account provider,
 *         `credentials_unavailable` when the store cannot be decrypted, and
 *         `coding_plan_<x>_jwt_required` when a token is missing.
 */
export declare function resolveResetAuthorization(providerId: string, env?: NodeJS.ProcessEnv): Promise<ResetAuthorization>;
/** Fetch the current card inventory. */
export declare function readResetStatus(providerId: string, fetchImpl?: typeof globalThis.fetch, env?: NodeJS.ProcessEnv): Promise<ResetCardStatus>;
export interface ResetUseResult {
    used: boolean;
    /** Set when the backend declined the opportunity (code 3301). */
    nextTryAt?: number;
}
/**
 * Spend one card.
 *
 * The idempotency key is what makes a retry safe: the same key always answers
 * the same outcome instead of consuming a second card. The caller supplies it
 * (the route layer derives one per request), so a client that retries can
 * reuse the value it already sent.
 */
export declare function useResetCard(providerId: string, resetType: ResetType, idempotencyKey: string, fetchImpl?: typeof globalThis.fetch, env?: NodeJS.ProcessEnv): Promise<ResetUseResult>;
/**
 * Ask whether a reset would be granted right now.
 *
 * A denial (code 3301) is a normal answer carrying `next_try_at`, not a
 * failure — the UI shows a countdown rather than an error.
 */
export declare function requestResetOpportunity(providerId: string, idempotencyKey: string, fetchImpl?: typeof globalThis.fetch, env?: NodeJS.ProcessEnv): Promise<{
    granted: boolean;
    nextTryAt: number | null;
}>;
/** Mark the reset history read (clears the unread badge). */
export declare function markResetHistoryRead(providerId: string, fetchImpl?: typeof globalThis.fetch, env?: NodeJS.ProcessEnv): Promise<void>;
/** Exposed for the eligibility check the route layer runs before any spend. */
export declare function codingPlanProviderIds(): string[];
//# sourceMappingURL=coding-plan.d.ts.map