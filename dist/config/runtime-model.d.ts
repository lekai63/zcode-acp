/**
 * runtimeModel overlay plumbing.
 *
 * The runtimeModel names the provider+model a session should use. For THIRD-
 * PARTY providers it also carries `apiKey` as `{source:"inline", value:"<key>"}`;
 * the backend resolves model-call auth from the overlay itself, so omitting it
 * yields HTTP 401 "Missing API key". Builtin providers keep using their own
 * OAuth/config auth and never inline a key. `apiFormat` mirrors `kind`.
 *
 * Two uses:
 *
 *   1. Resume/load FALLBACK overlay (`buildResumeRuntimeModel`, via
 *      `resumePreservingModel` in handlers/session.ts): sessions are resumed
 *      faithfully (keeping their own model) and this overlay is only applied
 *      when that resume fails outright — history carrying a stale/revoked
 *      third-party model. It pins onto the FIRST enabled provider's FIRST
 *      model as a known-working repair, not as a default choice.
 *
 *   2. Model switch (`applyModelSwitch`): UI/slash model switching goes through
 *      `session/setModel` with both a `model` ref and a `runtimeModel` provider
 *      definition (runtime-only via `persistAsWorkspaceLastUsed:false`).
 *
 * Note: a provider registry push (`workspace/updateProviderRegistry`) is ALSO
 * required for the backend to recognise third-party providers at all — without
 * it the turn fails with `provider_not_configured` before auth is even tried.
 * See provider-registry.ts.
 */
import { formatModelValue } from "./options.js";
import type { ModelRef } from "./options.js";
import type { ZcodeAcpServer } from "../server.js";
/**
 * Build a runtimeModel overlay for the given provider+model.
 *
 * For THIRD-PARTY providers the overlay MUST carry `apiKey` as the inline union
 * `{source:"inline", value:"<key>"}` — the backend resolves model-call auth from
 * the runtimeModel itself, so omitting it yields HTTP 401 "Missing API key".
 * (This was previously believed unnecessary; live probing proved otherwise.)
 * Builtin providers resolve auth from their own OAuth/config store, so no
 * apiKey is sent for them. `apiFormat` mirrors `kind` per the backend's catalog.
 */
export declare function buildRuntimeModel(ref: ModelRef, revision?: string): unknown | null;
/**
 * Build the resume-time FALLBACK overlay pinned to the first enabled
 * provider's first model — a known-working repair for sessions whose history
 * references an unavailable model. Only applied when a faithful (no-overlay)
 * resume fails; see resumePreservingModel in handlers/session.ts.
 */
export declare function buildResumeRuntimeModel(): unknown | null;
/**
 * Switch a session's model via `session/setModel`.
 *
 * `value` is the configOption value: either `"providerId\modelId"` (encoded) or
 * a legacy plain modelId (resolved to the first enabled builtin provider).
 *
 * Sends BOTH a `model` ref (the target) AND a `runtimeModel` (the full provider
 * definition). The runtimeModel lets the backend register the provider into its
 * workspace catalog (so even third-party / non-default models are recognised),
 * while `model` names the selection. `persistAsWorkspaceLastUsed:false` keeps
 * this a runtime-only change. Invalidates the model cache on success.
 *
 * NOTE: the older `session/updateRuntimeModelConfig` path returns `changed:false`
 * on current backends without applying — `session/setModel` is the working
 * protocol since the backend model-management refactor.
 */
export declare function applyModelSwitch(server: ZcodeAcpServer, zcodeSid: string, value: string): Promise<boolean>;
/** Invalidate the session-level model cache after a switch. */
export declare function invalidateModelCache(server: ZcodeAcpServer, zcodeSid: string): void;
export { formatModelValue };
//# sourceMappingURL=runtime-model.d.ts.map