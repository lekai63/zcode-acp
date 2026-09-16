/**
 * configOptions + modes construction and session/set_config_option dispatch.
 *
 * Reads `session/read` `settings.*` for current values (NOT projection.mode,
 * which is a zombie value), with config.json fallbacks for the model list.
 * set_config_option: mode/thought forward to setMode/setThoughtLevel; model
 * routes through `runtimeModel` (runtime-model.ts) because the backend rejects
 * the persistence path. After a change, re-builds the option and emits a
 * `config_option_update` (+ `current_mode_update` for mode) so the editor UI
 * reflects the new state.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
interface ProviderModelsJson {
    [modelId: string]: {
        limit?: {
            context?: number;
        };
    } | undefined;
}
/** A single provider's entry in config.json (`provider.<providerId>`). */
interface ProviderEntry {
    name?: string;
    kind?: string;
    enabled?: boolean;
    options?: {
        baseURL?: string;
        apiKey?: string;
        apiKeyRequired?: boolean;
    };
    models?: ProviderModelsJson;
}
/**
 * Fallback defaults for when config.json is unreadable or has no enabled
 * provider — keeps a freshly-installed editor functional. Must stay in sync
 * with the model the app ships first in its provider list.
 */
export declare const DEFAULT_PROVIDER_ID = "builtin:bigmodel-coding-plan";
export declare const DEFAULT_PROVIDER_NAME = "BigModel";
export declare const DEFAULT_MODEL_ID = "GLM-5.3";
/** A model selectable in the dropdown, with its owning provider. */
export interface ModelRef {
    providerId: string;
    providerName: string;
    modelId: string;
}
/**
 * Collect models from config.json for the dropdown.
 */
export declare function loadAllModels(): ModelRef[];
/** Look up a provider entry by id (any provider, not just enabled). */
export declare function findProviderConfig(providerId: string): ProviderEntry | null;
/** Read the context-window size for a provider+model from config.json. */
export declare function modelContextWindow(providerId: string, modelId: string): number;
/** Builtin providerIds are prefixed with `builtin:` (e.g. `builtin:bigmodel`). */
export declare function isBuiltinProvider(providerId: string): boolean;
/**
 * Encode a provider+model pair into a configOption `value` string.
 *
 * Always `providerId\modelId` — builtins included. A collision-only prefix
 * would advertise different id shapes depending on how many coding plans the
 * user has enabled. `\` is unambiguous because providerIds (UUIDs / builtin:
 * slugs) and modelIds (`/`-separated) never contain it.
 *
 * Inbound, `parseModelValue` still accepts a legacy bare modelId.
 */
export declare function formatModelValue(providerId: string, modelId: string): string;
/**
 * Parse a configOption `value` back into { providerId, modelId }.
 *
 * A value without `\` is a legacy bare modelId → resolve to the first enabled
 * builtin provider. A value with `\` is the current provider+model encoding.
 */
export declare function parseModelValue(value: string): {
    providerId: string;
    modelId: string;
};
/** Build the ACP SessionModeState ({currentModeId, availableModes}).
 *  zcodeSid null = pending session (session/new not yet materialized) — skip
 *  the backend read and return defaults. */
export declare function buildModes(server: ZcodeAcpServer, zcodeSid: string | null): Promise<acp.SessionModeState>;
export declare function orderThoughtVariants(variants: string[]): Array<{
    value: string;
    name: string;
}>;
/** Build the ACP configOptions array (3 items: model/mode/thought).
 *  zcodeSid null = pending session — skip the backend read and use defaults;
 *  mode defaults to "yolo" (the mode session/create hardcodes) so the dropdown
 *  matches the mode indicator for a fresh session.
 *  `receiverRoot` is the clientConnectionRoot of the client the array is
 *  delivered to — the quota pseudo-option is appended only for martty
 *  connections (ADR-0021); other receivers get the spec-clean 3 options. */
export declare function buildConfigOptions(server: ZcodeAcpServer, zcodeSid: string | null, receiverRoot?: unknown): Promise<acp.SessionConfigOption[]>;
/**
 * Dispatch session/set_config_option. mode/thought forward to setMode/
 * setThoughtLevel; model routes through applyModelSwitch (runtime-model.ts).
 *
 * Returns `{ kind, currentValue, options }` so the caller can emit the update
 * notifications, or null when the configId is unknown / model switch fails.
 */
export declare function setConfigOption(server: ZcodeAcpServer, zcodeSid: string, configId: string, value: string): Promise<{
    kind: "model" | "mode" | "thought";
    currentValue: string;
} | null>;
/** Emit a config_option_update (+ current_mode_update for mode) after a change.
 *  Returns the rebuilt options so the caller can include them in the response.
 *
 *  Every payload is ALSO broadcast to the other attached clients (the CLI
 *  window when the switch came from the phone, and vice versa) — a settings
 *  change is per-session state, not per-connection.
 *
 *  For model switches, also emit a usage_update with the NEW model's context
 *  window (from config.json) so the editor's context bar refreshes immediately
 *  instead of waiting for the next turn's UsageDelta. */
export declare function emitConfigOptionUpdate(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string, kind: "model" | "mode" | "thought"): Promise<acp.SessionConfigOption[]>;
export {};
//# sourceMappingURL=options.d.ts.map