/**
 * Slash-command interception inside `session/prompt`.
 *
 * When the prompt text starts with `/`, dispatch the matching ZCode method
 * directly (compact/goal/fork/model/mode/thought), emit a short
 * feedback `agent_message_chunk`, and return `end_turn` — never reaching the
 * normal turn loop.
 *
 * Commands handled by the ZCode backend (skill/init/code-review and other
 * plugin commands) are NOT intercepted here — they pass through to
 * `session/send` and the backend resolves them before the model sees them.
 *
 * Commands that require the ZCode TUI (plugins/login/logout/new/resume/
 * locale/expert/workflow/workflows/effort/help) return a friendly error
 * instead of passing raw text to the model (which would confuse it).
 *
 * `/mcp` lists all configured MCP servers (from config.json + plugins),
 * showing the user exactly what's available without needing the TUI.
 *
 * `/quota` is the exception: it does not call ZCode at all — it queries the
 * GLM Coding Plan usage API directly and renders the result.
 *
 * Anything else starting with `/` is NOT a command: only the names advertised
 * in the editor's `/` completion menu (plus the passthrough built-ins above)
 * go the command route. Unknown `/x` is sent to the model as plain text via
 * {@link neutralizeSlashText} — the backend's command resolver must never see
 * it, because an unresolvable name can hard-fail the turn and wedge the
 * session (e.g. pasting a directory path like `/Users/me/project`).
 *
 * Returns the PromptResponse when intercepted, or null to let the caller run a
 * normal turn.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
/**
 * Neutralise slash-command resolution for prompts that are NOT real commands.
 *
 * The backend parses any prompt whose trimmed text starts with `/` as a
 * command invocation (`name + args`), and an unresolvable name can fail the
 * whole turn. This helper decides the wire text for `/`-leading prompts:
 *   - known command → returned unchanged (the backend resolves it);
 *   - anything else (e.g. a pasted path `/Users/me/proj`) → prefixed with a
 *     zero-width space. U+200B survives the backend's trim(), so the
 * `^\/` command parse can never match, while the model sees the prompt
 *     verbatim (ZWSP is invisible and tokenizes as nothing).
 *
 * Non-slash prompts pass through unchanged.
 */
export declare function neutralizeSlashText(text: string): string;
/** Try to intercept a slash command. Returns a PromptResponse when handled, null otherwise. */
export declare function handleSlashCommand(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string, text: string): Promise<acp.PromptResponse | null>;
//# sourceMappingURL=slash.d.ts.map