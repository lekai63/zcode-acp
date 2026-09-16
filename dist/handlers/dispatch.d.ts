/**
 * dispatchEvent — the single funnel that turns an InternalEvent into an ACP
 * `session/update` notification.
 *
 * Each event kind is serialised here so the translation layers stay focused
 * on producing the internal shape. The Bash terminal-output protocol (the
 * 2-notification split: terminal_output + terminal_exit) is fully implemented
 * below in dispatchTerminalUpdate.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { InternalEvent } from "../translators/types.js";
import type { ZcodeAcpServer } from "../server.js";
/** Test hook: re-arm the one-shot EPERM hint. */
export declare function resetSandboxEpermHintForTest(): void;
/** Dispatch one internal event to the ACP client as a session/update. */
export declare function dispatchEvent(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, ev: InternalEvent, chunkMsgId: string): Promise<void>;
//# sourceMappingURL=dispatch.d.ts.map