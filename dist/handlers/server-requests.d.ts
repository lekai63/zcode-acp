/**
 * Handle zcode-initiated server→client requests during a turn.
 *
 * ZCode's interaction broker dispatches three request kinds, all bridged onto
 * ACP `session/requestPermission` (Zed supports it natively; elicitation is
 * not supported):
 *   - interaction/requestPermission (tool auth)       → direct option mapping
 *   - interaction/requestUserInput (ExitPlanMode)     → approve/reject options
 *   - interaction/requestUserInput (AskUserQuestion)  → per-question popups
 *     (single-select: one popup; multi-select: per-option Include/Skip)
 *
 * Reannounce dedup: ZCode reannounces unanswered requests every ~1s sharing
 * the same requestId/toolCallId. The first request forwards to the client;
 * reannounces either get the cached result (if it arrived) or just record
 * their zcode id for a later unified reply.
 *
 * Reconnect resend: a client-side request fired while a remote client was
 * offline never reaches it. Undecided waits are tracked (ActiveInteraction)
 * and re-sent to a client when its session/load / session/resume completes —
 * the re-send joins the existing first-response-wins race.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeBackend } from "../backend/client.js";
import type { ZcodeInteractionResponse, ZcodeInteractionUserInputParams } from "../backend/types.js";
import type { ClientLike } from "../remote/broadcast.js";
import type { PendingTurn, ZcodeAcpServer } from "../server.js";
/** A dedup entry tracking reannounced zcode ids + the cached result. */
interface DedupEntry {
    zcodeIds: Array<number | string>;
    result?: ZcodeInteractionResponse;
}
/** Per-server reannounce dedup state (lazy-initialised). */
export declare function getPendingInteractions(server: ZcodeAcpServer): Map<string, DedupEntry>;
/**
 * Re-send this session's still-undecided interaction requests to a client that
 * just (re)connected, so an agent question that fired while the client was
 * offline becomes answerable there. Fire-and-forget, best-effort: each re-send
 * joins the existing first-response-wins race; if another client answers first,
 * the re-send is cancelled and the reconnected client's dialog (if any) drops.
 */
export declare function resendPendingInteractions(server: ZcodeAcpServer, client: ClientLike, acpSid: string): void;
/**
 * Drain and handle pending zcode server→client requests for THIS session only.
 * Returns true if any were handled (used by the turn loop to refresh the
 * no-progress timer).
 *
 * The backend's `serverRequests` queue is shared across all sessions (a single
 * subprocess serves them all). Without filtering, session A's turn loop could
 * pop session B's permission request and forward it to A's client — the popup
 * lands in the wrong session. When `turn` is available we filter by
 * `params.sessionId` so each turn loop only consumes its own requests; others
 * are re-queued for their owner. Without `turn` (tests / non-turn callers) we
 * process everything (legacy behaviour).
 */
export declare function handleServerRequests(server: ZcodeAcpServer, backend: ZcodeBackend, cx: acp.AgentContext, acpSid: string, turn?: PendingTurn): Promise<boolean>;
/**
 * AskUserQuestion: sequential per-question, multi-select per-option.
 *
 * Single-select: one popup per question; Skip/cancel → overall decline.
 * Multi-select: one Include/Skip popup per option; Include picks comma-joined.
 */
export declare function handleAskUserQuestion(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, params: ZcodeInteractionUserInputParams, turn?: PendingTurn): Promise<ZcodeInteractionResponse>;
/**
 * One candidate row for the `/resume` session picker.
 */
export interface SessionPickItem {
    /** Backend (zcode) session id — the value returned on selection. */
    sessionId: string;
    /** Human label (title + date) shown in the dropdown / popup. */
    label: string;
}
/**
 * `/resume` session picker: ask the user to choose a past session via the
 * editor's interaction UI — an `elicitation/create` enum dropdown when the
 * client supports forms, else `session/request_permission` option buttons.
 * Returns the chosen backend session id, or null when declined/cancelled or
 * the request failed (no turn context — the slash path has no PendingTurn).
 */
export declare function askSessionPick(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, items: SessionPickItem[]): Promise<string | null>;
export {};
//# sourceMappingURL=server-requests.d.ts.map