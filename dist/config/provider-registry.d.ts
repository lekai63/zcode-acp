/**
 * Build a provider-registry payload for `workspace/updateProviderRegistry`.
 *
 * The V4 backend doesn't auto-load providers from config.json — the host must
 * push them via this RPC after `session/create`, otherwise third-party
 * providers fail with `provider_not_configured` (misclassified as a network
 * error after turn-retry exhausts). ZCode app does this from its
 * ModelProviderService; the bridge mirrors it by reading config.json directly.
 *
 * Provider element schema (from the backend's `j7t` converter in zcode.cjs):
 *   { providerId, apiKey?, apiKeyRequired?, apiFormat?, baseURL?, headers?,
 *     kind?, label?, models?, providerOptions?, source? }
 * `apiKey` is a discriminated union `{source:"inline", value:"<key>"}` — a
 * bare string is rejected. `apiFormat` maps from `kind`:
 *   anthropic → "anthropic-messages", openai-compatible → "openai-chat-completions".
 */
/** A model entry in config.json (`provider.<id>.models.<modelId>`). */
export interface ModelEntry {
    name?: string;
    limit?: {
        context?: number;
        output?: number;
    };
    reasoning?: {
        enabled?: boolean;
        variants?: string[];
        defaultVariant?: string;
    };
}
/** Registry payload for `workspace/updateProviderRegistry`. */
export interface ProviderRegistryPayload {
    providers: ReadonlyArray<Record<string, unknown>>;
    generatedAt: number;
    revision: string;
}
/**
 * Build a single model element from a config.json model entry.
 *
 * Beyond `{modelId}`, the backend's schema accepts label / contextWindow /
 * maxOutputTokens / reasoning. `reasoning` is the important one: without it
 * the backend falls back to the apiFormat's default thought levels (a 2-state
 * enabled/disabled for anthropic-messages), losing the provider's real
 * variants (e.g. max/high/low) — the session then shows a wrong thought-level
 * dropdown. config.json's `variants`/`defaultVariant` map to the protocol's
 * `levels`/`defaultLevel`.
 *
 * Exported: runtime-model.ts reuses it for the `runtimeModel` overlay — both
 * paths must carry identical model definitions or the overlay (resume /
 * setModel) silently downgrades the session back to the 2-state default.
 */
export declare function buildModelElement(modelId: string, m: ModelEntry): Record<string, unknown>;
/**
 * Build the registry payload from ALL providers in config.json.
 *
 * Unlike `loadAllModels` (dropdown, enabled-only), the registry pushes every
 * configured provider so the backend recognises any of them when a session
 * switches to it. The backend applies its own enable/availability rules.
 *
 * Providers with zero models are skipped: the backend's schema requires
 * `models` to have >= 1 item and rejects the WHOLE payload otherwise, so a
 * single empty provider (e.g. a plan tier with no models listed yet) would
 * break the registry sync and every session would fail with
 * `provider_not_configured` before auth is even tried.
 */
export declare function buildProviderRegistry(): ProviderRegistryPayload;
//# sourceMappingURL=provider-registry.d.ts.map