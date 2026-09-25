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
 * locale/expert/effort/help) return a friendly error instead of passing raw
 * text to the model (which would confuse it).
 *
 * `/workflow` and `/workflows` are gated by the dynamic-workflow verdict
 * (src/config/workflow-gate.ts): disabled/pending → friendly notice; enabled
 * → the former passes through to the backend's builtin prompt expansion and
 * the latter renders a local saved-workflows/runs listing.
 *
 * `/mcp` lists all configured MCP servers (from config.json + plugins),
 * showing the user exactly what's available without needing the TUI. When the
 * backend answers `mcp/list` (mode:"status"), the card is upgraded to live
 * per-server health (status / tool count / failureKind).
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
 * Wire text for `/`-leading prompts. Identity on 0.16.9 — see below.
 *
 * This used to prefix unknown `/x` prompts with a zero-width space, on the
 * reverse-engineered belief that the backend hard-fails a turn whose prompt
 * fails command resolution. The open-sourced runtime disproves that: command
 * parsing recognizes ONLY /compact, /fork, /rewind
 * (core/src/runtime/methods/turn.ts:105-106,240-267), and every other name
 * returns undefined from resolveZCodeCustomCommandPrompt — the input facade
 * then passes the ORIGINAL text to the model as a normal prompt, with no
 * half-expansion and no turn failure (bootstrap/src/custom-command-prompt.ts:31-44,
 * comment at :39-41). The ZWSP injection therefore only corrupted session
 * history and model input.
 *
 * Kept as the single seam where a legacy-build guard would live if a build
 * that DOES hard-fail unknown commands ever needs supporting again.
 */
export declare function neutralizeSlashText(text: string): string;
/**
 * Try to intercept a slash command. Returns a PromptResponse when handled, null otherwise.
 *
 * `client` is the REQUESTING connection (runPrompt's 6th arg, undefined for
 * client-less invocations). Only replay-shaped dispatch — /resume's history
 * replay — uses it; command feedback keeps going through the broadcast cx.
 */
export declare function handleSlashCommand(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, zcodeSid: string, text: string, client?: acp.AgentContext): Promise<acp.PromptResponse | null>;
//# sourceMappingURL=slash.d.ts.map