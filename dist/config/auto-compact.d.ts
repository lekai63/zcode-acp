/**
 * Auto-compact: when the session's context-window usage exceeds a threshold,
 * automatically invoke `session/compact` so the next prompt has room.
 *
 * Configured via `ZCODE_ACP_AUTO_COMPACT_THRESHOLD` (absolute token count;
 * 0/unset = disabled). The compaction target is decided by the zcode backend
 * — we only control *when* to trigger.
 *
 * Triggered from `prompt()` after a successful `end_turn`, before the response
 * returns. Failures are best-effort (logged, never thrown) so they never break
 * the prompt response.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
/** ENV: `ZCODE_ACP_AUTO_COMPACT_THRESHOLD` — absolute token count (0 = disabled). */
export declare function autoCompactThreshold(): number;
/**
 * If the threshold is configured and the session's current context usage meets
 * or exceeds it, invoke `compact()`. No-op when the threshold is unset/zero,
 * when usage is below the threshold, or on any error (best-effort).
 */
export declare function maybeAutoCompact(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string): Promise<void>;
//# sourceMappingURL=auto-compact.d.ts.map