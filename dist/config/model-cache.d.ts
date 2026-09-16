/**
 * Session-level model cache + initial usage emission.
 *
 * `currentModelCached` avoids a `session/read` round-trip on every usage_update
 * (a high-frequency path). `emitInitialUsage` sends one usage_update right
 * after resume/load so the editor shows the context bar immediately (only when
 * there's actual token data — resume before any turn has 0, which we skip).
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
import type { ProjectionDiffer } from "../translators/projection-differ.js";
/**
 * Read the session's current model as an encoded `"providerId\modelId"` string,
 * with a per-session cache. Returns the encoded form so callers can resolve the
 * provider (for context-window lookup / model switching) without a second read.
 */
export declare function currentModelCached(server: ZcodeAcpServer, zcodeSid: string): Promise<string>;
/**
 * Emit an initial usage_update after resume/load so the editor shows the
 * context bar. Skips when there's no token data (resume before any turn → 0).
 * Also syncs the differ's usage baseline so the first turn won't re-emit it.
 *
 * Note: the backend's `projection.contextUsed` is 0 after resume — it only
 * updates after a new turn completes. So a resumed session with history won't
 * show a context bar until the first post-resume message. That's acceptable:
 * we don't have a reliable way to estimate the pre-resume context size, and
 * guessing wrong (e.g. from per-turn token totals that include re-sent history)
 * is worse than showing nothing.
 */
export declare function emitInitialUsage(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string, differ: ProjectionDiffer | undefined): Promise<void>;
//# sourceMappingURL=model-cache.d.ts.map