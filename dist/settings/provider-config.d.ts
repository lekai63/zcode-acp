/**
 * Read/write for the desktop's personal provider config
 * (`~/.zcode/v2/provider_config.json`).
 *
 * This is where 3.12+ stores every user-added provider and model; the backend
 * registry reads it directly and absorbs external writes through a ~1s poll,
 * so a change here takes effect with NO restart and NO RPC
 * (`personal-provider-config-repository.ts`).
 *
 * What this module deliberately does NOT do:
 *
 *  - **Create free-form providers.** A provider rule carries credentials, an
 *    API protocol type and a model list, and getting it wrong yields a provider
 *    that fails at request time. Providers are only ever created FROM A
 *    TEMPLATE of the bundled table (`createProviderFromTemplate`), the way the
 *    desktop app's "add provider" does it (packages/provider/src/config-service.ts
 *    `createPersonalProvider`): the rule references the template, so endpoint,
 *    API type and model list stay the app's own; only the key is user input.
 *  - **Write `account:*` access.** The registry rejects `zhipu-account` access
 *    on personal rules outright — those providers come from the bundled table
 *    plus the account snapshot the bridge pushes. Writing one produces a file
 *    the backend refuses to load.
 *
 * Everything else the app's model page can do is here: enable/disable, rename,
 * replace a key, delete a personal provider, add/remove a model on an existing
 * provider, and edit a model's context window and reasoning-level vocabulary.
 *
 * Canonical form matters: the file is written with 2-space indentation and NO
 * trailing newline, matching the app's own writer. A non-canonical file is
 * read fine but rewritten by the app on its next save, which would look like
 * our edit "reverting".
 */
export interface ProviderModelConfig {
    enabled?: boolean;
    properties?: {
        contextWindow?: number;
    };
    optionSpecs?: {
        reasoningLevel?: {
            values?: string[];
        };
    };
}
/** A model rule as stored, with its owning provider. */
export interface ModelRule {
    providerId: string;
    modelId: string;
    config: ProviderModelConfig;
}
export interface ProviderRule {
    providerId: string;
    /** Set on providers created from a bundled template; endpoint and models come from it. */
    templateId?: string;
    providerName?: string;
    enabled?: boolean;
    config?: {
        access?: {
            type?: string;
            apiKey?: string;
        };
        api?: {
            type?: string;
            baseUrl?: string;
        };
        personalModelIds?: string[];
        modelOrder?: string[];
        [key: string]: unknown;
    };
}
export interface ProviderConfigFile {
    schemaVersion: number;
    config: {
        providerOrder?: string[];
        providerConfigRules: {
            providerRules: ProviderRule[];
        };
        modelConfigRules: {
            providerModelRules: ModelRule[];
            manualProviderModelRules: ModelRule[];
        };
        defaultModelSelection?: Record<string, unknown>;
    };
}
/**
 * Read the file, or return an empty canonical document when it is absent.
 *
 * @throws when the file exists but is malformed — the settings layer must
 *         refuse the write rather than base it on an empty document (the app's
 *         own reader degrades to an empty overlay while KEEPING the bad bytes,
 *         so silently overwriting would destroy what is still recoverable).
 */
export declare function readProviderConfig(): Promise<ProviderConfigFile>;
/**
 * Serialize in the app's canonical form: 2-space indentation, NO trailing
 * newline (the app's writer uses `JSON.stringify` directly). A trailing
 * newline is not an error to the reader, but the app rewrites the file to its
 * own canonical form on its next save, which makes our edit look reverted.
 */
export declare function encodeProviderConfig(doc: unknown): string;
/** Structural self-check run before the bytes land. */
export declare function validateProviderConfig(doc: Record<string, unknown>): boolean | string;
/**
 * Enable or disable a provider, and/or rename it.
 *
 * @param patch.enabled  `true`/`false` flips the rule's `enabled` flag; omit to
 *                       leave it alone.
 * @param patch.providerName renames the provider; omit to leave it alone.
 * @throws when the provider has no rule in this file (account-managed
 *         providers and bundled ones cannot be toggled here).
 */
export declare function updateProvider(providerId: string, patch: {
    enabled?: boolean;
    providerName?: string;
}): Promise<ProviderConfigFile>;
/**
 * Add a model to an existing provider, or update an existing rule.
 *
 * The model lands in `providerModelRules` (the list the app writes user models
 * to). A rule already present anywhere in either list is updated in place so a
 * repeated call is idempotent rather than duplicating.
 */
export declare function upsertModel(providerId: string, modelId: string, patch: ProviderModelConfig): Promise<ProviderConfigFile>;
/** Remove a model rule from both lists. */
export declare function removeModel(providerId: string, modelId: string): Promise<ProviderConfigFile>;
/** Read the raw file text (for the settings snapshot). Absent → null. */
export declare function readProviderConfigRaw(): Promise<string | null>;
/** The canonical bytes a document would be written as. */
export declare function canonicalBytes(doc: ProviderConfigFile): string;
/** A provider template of the bundled table (`zcode-builtin.json` `templateRules`). */
export interface ProviderTemplate {
    templateId: string;
    /** en-US name, falling back to zh-CN, then the id. */
    name: string;
    nameZh?: string;
    accessType: "api-key" | "zhipu-coding-plan-api-key";
    apiKeyManagementUrl?: string;
    apiType?: string;
    baseUrl?: string;
    modelIds: string[];
}
/**
 * The bundled provider table the CLI is launched with: the same file
 * `builtinProviderEnv` injects (next to the resolved CLI entry), else an
 * inherited `ZCODE_BUILTIN_PROVIDER_CONFIG_FILE`.
 */
export declare function builtinProviderTablePath(): string | null;
/** Templates of the bundled table, in table order. */
export declare function listProviderTemplates(tablePath?: string | null): ProviderTemplate[];
/**
 * Create a personal provider from a bundled template, as the desktop app's
 * "add provider" does: id `<template-seed>` (then `-2`, `-3`, …) clear of
 * every bundled and personal id, the template's display name de-duplicated
 * with ` 2`, ` 3`, …, group `standard-personal`, empty personal model lists,
 * appended to `providerOrder`.
 *
 * The key is stored with the TEMPLATE's access type: the personal overlay's
 * `access.type` replaces the template's (`ApiKeyAccessConfig.overlay`), so a
 * Coding Plan template saved as plain `api-key` would silently become a
 * pay-as-you-go provider.
 */
export declare function createProviderFromTemplate(input: {
    templateId: string;
    apiKey: string;
    providerName?: string;
}, tablePath?: string | null): Promise<{
    providerId: string;
    doc: ProviderConfigFile;
}>;
/**
 * Delete a personal provider with its model rules and order entry, as the
 * app's `deletePersonalProvider` does. Bundled and account providers have no
 * rule here and cannot be deleted.
 */
export declare function deleteProvider(providerId: string): Promise<ProviderConfigFile>;
/**
 * Replace a personal provider's key, keeping its access type (the rule's own,
 * else its template's, else `api-key`).
 */
export declare function setProviderApiKey(providerId: string, apiKey: string, tablePath?: string | null): Promise<ProviderConfigFile>;
//# sourceMappingURL=provider-config.d.ts.map