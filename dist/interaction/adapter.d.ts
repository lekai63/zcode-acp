/**
 * Interaction channel adapter: zcode `interaction/*` server→client requests
 * ↔ ACP `session/requestPermission`.
 *
 * ZCode's `createProtocolInteractionBroker` dispatches server→client requests
 * by tool. Zed supports `session/requestPermission` natively (the allow/reject
 * popup) but NOT elicitation, so all three interaction kinds map onto
 * requestPermission:
 *   - interaction/requestPermission (tool approval)         → direct mapping
 *   - interaction/requestUserInput (plan_approval / ExitPlanMode) → approve/reject
 *   - interaction/requestUserInput (AskUserQuestion)        → per-question options
 *     (single-select: one popup + Skip; multi-select: per-option Include/Skip)
 *
 * `requestPermission` is single-select, so multi-select questions are split
 * into per-option yes/no popups; the user's Include picks are comma-joined
 * into the final answer (mirrors the reference impl's `answers[q]: "a, b"`).
 */
import type { PermissionOption } from "@agentclientprotocol/sdk";
import type { ZcodeInteractionPermissionParams, ZcodeInteractionResponse, ZcodeInteractionUserInputParams } from "../backend/types.js";
export declare function isPermissionRequest(method: string): boolean;
export declare function isUserInputRequest(method: string): boolean;
export declare function isExitPlanMode(params: unknown): boolean;
/** AskUserQuestion = requestUserInput WITHOUT the plan_approval schema. */
export declare function isAskUserQuestion(method: string, params: unknown): boolean;
/**
 * Human one-line summary of a tool's input for a permission popup title.
 *
 * The command / file path IS the decision the user is making, and some clients
 * (martty) render only `toolCall.title` in their approval overlay — without
 * this summary the popup reads as a bare "tool" and the path is invisible.
 * Commands keep their head (the binary is the informative part); paths keep
 * their TAIL (the filename is). Spec-complete clients also render `content`,
 * which carries the full input (see `inputPopupContent`) — multi-line
 * commands included.
 */
export declare function describeToolInput(input: unknown): string | undefined;
/** Permission-request details shared by every toolCall builder below. */
interface PermissionToolCall {
    toolCallId: string;
    title?: string;
    content?: Array<{
        type: "content";
        content: {
            type: "text";
            text: string;
        };
    }>;
    locations?: Array<{
        path: string;
    }>;
    rawInput: unknown;
}
export declare function zcodePermissionToAcp(params: ZcodeInteractionPermissionParams, acpSid: string): {
    options: PermissionOption[];
    sessionId: string;
    toolCall: PermissionToolCall;
} | null;
/** Convert an ACP requestPermission response → zcode {decision, reason?}. */
export declare function acpPermissionResponseToZcode(acpResp: unknown): Extract<ZcodeInteractionResponse, {
    decision: string;
}>;
/** ExitPlanMode rendered as approve/reject permission options. */
export declare function exitPlanModeToAcpPermission(params: ZcodeInteractionUserInputParams, acpSid: string): {
    options: PermissionOption[];
    sessionId: string;
    toolCall: PermissionToolCall;
};
/** Convert an ACP response → zcode ExitPlanMode response. */
export declare function acpPermissionResponseToExitPlanMode(acpResp: unknown): Extract<ZcodeInteractionResponse, {
    action: string;
}>;
/**
 * Build an elicitation FORM for ExitPlanMode plan approval — the martty
 * surface (see handleSinglePermission's routing comment; the gate lives
 * there). martty renders the field's `description` through its full markdown
 * pipeline in a scrollable detail pane — the COMPLETE plan lives there, not
 * in a one-line popup title. The decision itself is a required enum field
 * (approve / reject); a cancelled or declined form maps to decline. The
 * caller falls back to the requestPermission path when the form channel
 * fails; that path carries the plan in `toolCall.content` for the same
 * reason.
 */
export declare function buildPlanApprovalElicitationForm(params: ZcodeInteractionUserInputParams, acpSid: string, toolCallId?: string): {
    mode: "form";
    sessionId: string;
    toolCallId?: string;
    message: string;
    requestedSchema: {
        type: "object";
        properties: Record<string, unknown>;
        required: string[];
    };
};
/**
 * Parse an elicitation form response → zcode ExitPlanMode response.
 * Mirrors `acpPermissionResponseToExitPlanMode`: approve → accept with
 * content.answer_0 (the backend reads answer_0), anything else → decline.
 */
export declare function parsePlanApprovalElicitationResponse(acpResp: unknown): Extract<ZcodeInteractionResponse, {
    action: string;
}>;
export interface AskUserQuestion {
    question: string;
    multiSelect: boolean;
    options: PermissionOption[];
}
/**
 * Split a zcode AskUserQuestion request into per-question descriptors.
 *
 * Single-select: one ACP option per label + a trailing Skip.
 * Multi-select: each label becomes a yes/no pair (optionId `<label>:yes` /
 * `<label>:no`) so the handler can pop one Include/Skip dialog per option.
 *
 * Returns null when there are no valid questions.
 */
export declare function splitAskUserQuestions(params: ZcodeInteractionUserInputParams): AskUserQuestion[] | null;
/** Build ACP requestPermission params for one AskUserQuestion question. */
export declare function buildAskUserAcpParams(params: ZcodeInteractionUserInputParams, acpSid: string, options: PermissionOption[], popupTitle?: string): {
    options: PermissionOption[];
    sessionId: string;
    toolCall: PermissionToolCall;
};
/**
 * Parse one ACP requestPermission response → "yes" | "no" | label | null.
 *
 * Multi-select: optionId `<label>:yes` → "yes", `<label>:no` → "no".
 * Single-select: optionId is the label; __skip__ / cancel → null.
 */
export declare function parseAskUserResponse(acpResp: unknown): string | null;
/**
 * Build an elicitation form schema for an AskUserQuestion request.
 *
 * ACP/MCP elicitation string fields are EITHER an enum (restricted dropdown) OR
 * free text — the spec ("enum strictly restricts the allowed string values")
 * forbids "dropdown whose last row accepts custom input". To give the user both
 * a pick list AND custom entry, each question is rendered as TWO fields:
 *
 *   - `q_<i>`: enum dropdown of the model's suggested answers + a trailing
 *     "Skip this question" option. Uses `oneOf`/`anyOf` with `{const, title}`
 *     so the skip sentinel has a readable label instead of the raw `__skip__`.
 *   - `q_<i>_other`: free-text string. If non-empty it OVERRIDES the dropdown
 *     (single-select) or is APPENDED to the picked values (multi-select).
 *
 * A non-required free-text field plus a Skip enum option lets the user opt out
 * of a single question without cancelling the whole form. Required is left
 * empty so neither field forces an answer.
 */
export declare function buildAskUserElicitationForm(params: ZcodeInteractionUserInputParams, acpSid: string, toolCallId?: string): {
    mode: "form";
    sessionId: string;
    toolCallId?: string;
    message: string;
    requestedSchema: {
        type: "object";
        properties: Record<string, unknown>;
        required: string[];
    };
};
/**
 * Parse an elicitation form response into the zcode answers map.
 *
 * For each question the free-text companion (`q_<i>_other`) takes precedence:
 *   - Single-select: non-empty free-text OVERRIDES the dropdown. Otherwise the
 *     dropdown value is used, unless it's the skip sentinel or absent (omitted).
 *   - Multi-select: free-text is APPENDED to the picked values (de-duped, order
 *     preserved). The skip sentinel never appears in multi-select.
 * Returns null if the user declined/cancelled.
 */
export declare function parseAskUserElicitationResponse(acpResp: unknown, params: ZcodeInteractionUserInputParams): Record<string, string> | null;
export {};
//# sourceMappingURL=adapter.d.ts.map