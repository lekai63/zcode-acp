/**
 * Account-provider config: mirror the desktop host's
 * `provider/updateAccountConfig` push.
 *
 * 3.12+ app-servers build their provider registry from three sources: the
 * bundled `zcode-builtin.json` table, the personal `provider_config.json`, and
 * an ACCOUNT snapshot that the desktop host computes from the signed-in user's
 * plan state and pushes over `provider/updateAccountConfig`. Headless launches
 * have no host to push it, and standalone credential-derived entitlement
 * proved unreliable (2026-09: every `account:*` provider read `entitled:false`
 * while the desktop run of the same machine had
 * `account:bigmodel-individual-coding-plan` entitled — the GLM models the user's
 * config selects were missing from `settings.model.available` entirely, and
 * `session/setModel` failed with "Provider Registry 中不存在 Model").
 *
 * Pushing the snapshot ourselves restores parity: verified 2026-09, a push
 * turned `settings.model.available` from 3 third-party models into 21 including
 * `account:bigmodel-individual-coding-plan/GLM-5.3`, and the switch succeeded.
 *
 * The push needs the exact `basedOnZCodeBuiltinRevision` the runtime computed:
 * `zcode-builtin:<file.revision>:<sha256(resolve(activeConfigFilePath))>` (the
 * hash covers the PATH, not the bytes — verified against the runtime's own
 * logged revision). A mismatch is accepted by the schema but the registry
 * ignores it, so the path we hash must be the same one the CLI resolved.
 */
import type { ZcodeBackend } from "../backend/client.js";
/**
 * Map a config.json builtin provider id to the account-provider id the
 * registry actually exposes. `builtin:<family>-coding-plan` is the
 * individual-plan spelling in config.json, while the table names it
 * `account:<family>-individual-coding-plan`; other plan spellings match
 * one-to-one. Unknown ids pass through unchanged.
 */
export declare function accountProviderIdFor(providerId: string): string;
/** Reverse map: account-provider id → the config.json id it corresponds to. */
export declare function configProviderIdFor(providerId: string): string;
/**
 * The request auth the bridge can serve for an `account:*` coding-plan model,
 * or null when it cannot answer.
 *
 * The 3.12+ backend asks its host for provider runtime headers before EVERY
 * model request on a `zhipu-account` provider (bundle-verified: the only other
 * suppliers are the desktop host and the CLI's own "standalone" credential
 * pair, whose identity half this machine never wrote — the api-key half sits
 * in the CLI's ENCRYPTED credential store, unreadable here). The desktop
 * answers with the plan's API key; the bridge can serve the same plan's key
 * from legacy config.json — the same key the pre-3.12 `builtin:` provider of
 * that plan used. Only the individual coding plan is served: start-plan needs
 * an Aliyun captcha (stays refused, issue #123), and team/off-peak keys are
 * store-encrypted.
 */
export declare function codingPlanRequestAuthFor(accountProviderId: string | undefined): {
    apiKey: string;
} | null;
/** The `provider/updateAccountConfig` payload (schema-verified shape). */ export interface AccountProviderPayload {
    revision: string;
    basedOnZCodeBuiltinRevision: string;
    providers: Record<string, {
        builtinModelIds?: string[];
        access: {
            type: string;
            entitled: boolean;
        };
    }>;
    states: Record<string, {
        availability: "available" | "pending" | "unavailable" | "unknown";
        entitled: boolean;
        current: boolean;
    }>;
}
/**
 * Build the account snapshot: every coding-plan provider the bundled table
 * declares, with entitlement taken from config.json's enabled builtin plans.
 * Returns null when there is nothing to push (no table, no zhipu providers).
 */
export declare function buildAccountProviderConfig(): AccountProviderPayload | null;
/**
 * Push the account snapshot to the backend. Best-effort: a failure logs and
 * returns false — session creation must proceed regardless (the account
 * providers simply stay absent from the model dropdown). A backend that does
 * not know the method (older CLI) is a quiet no-op, not a warning.
 */
export declare function pushAccountProviderConfig(backend: ZcodeBackend, nextId: () => number): Promise<boolean>;
//# sourceMappingURL=account-provider.d.ts.map