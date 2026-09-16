/**
 * Tool translation helpers: kind mapping, input summary, result-content
 * shaping, diff parsing, location extraction, exit-code extraction, error
 * rendering.
 *
 * These are pure functions shared by `EventTranslator` (event-stream path) and
 * `ProjectionDiffer` (snapshot path) so both render the same titles/content for
 * the same tool.
 */
import type { ToolCallContent, ToolCallLocation, ToolKind } from "@agentclientprotocol/sdk";
/** zcode toolName → ACP ToolKind. Keys are case-duplicated for safety. */
export declare const TOOL_KIND_MAP: Record<string, ToolKind>;
/**
 * Extract a one-line summary from a tool's input object (used for the ACP
 * ToolCall `title`). Priority: command / description / query / file_path /
 * path / pattern / prompt. Bash `command` is NOT truncated (Zed's terminal
 * card needs the full command); other fields truncate to SUMMARY_MAX. Falls
 * back to compact JSON, then String(input). Returns "" for empty input.
 */
export declare function summarizeToolInput(_toolName: string, inp: unknown): string;
/**
 * Render a tool result/progress output into a readable string. The zcode
 * standard result structure is `{success, content, perf:{...}}`; the `content`
 * field is the actual command output the user cares about. On `success:false`
 * with empty content, prefix the error/message. Other shapes fall back to JSON.
 */
export declare function renderToolOutput(output: unknown): string;
/**
 * Extract a Bash exit code from a result payload. Reads `perf.exitCode`
 * (integer); falls back to inferring 1 on `success:false`, else 0. For error
 * payloads with no usable dict, returns 1 when `isError`.
 */
export declare function extractExitCode(resultPayload: unknown, isError?: boolean): number;
/**
 * Build ACP `ToolCallContent[]` (type:"content") from a result, for display in
 * the editor's tool card. Error → code fence; Read → plain text; Bash →
 * `console` code block; default → plain text. Returns [] when there's no text
 * (caller skips to avoid clobbering rawOutput).
 *
 * Edit/Write are NOT handled here — their diff is dispatched separately from
 * `session/messages` metadata (more timely and reliable).
 */
export declare function buildResultContent(toolName: string, resultPayload: unknown, isError?: boolean): ToolCallContent[];
/**
 * Build ACP `ToolCallContent[]` with the "diff" variant from a tool part's
 * `metadata.display` (kind:"file_diff"). Each hunk → one
 * `{type:"diff", path, oldText, newText}` where the texts are the old/new
 * line sets (not unified-diff strings). Empty `oldText` → null (new-file
 * convention). Returns [] when display isn't a file_diff or has no patches.
 */
export declare function buildDiffContent(display: unknown): ToolCallContent[];
/**
 * Extract ACP `ToolCallLocation[]` ({path, line?}) for deep-linking. Edit/Write
 * completion prefers the diff display's `newStart` (precise change line); other
 * tools derive from input (Read → file_path+offset, Glob/Grep → search dir).
 */
export declare function extractLocations(toolName: string, inp: unknown, display?: unknown): ToolCallLocation[];
/**
 * Structured sub-agent metadata extracted from an Agent/Task tool result's
 * content. The zcode backend appends these as plain-text markers at the end of
 * the result content (e.g. `agentId: agent_xxx (use SendMessage ...)` and
 * `<usage>subagent_tokens: 40904\ntool_uses: 1\nduration_ms: 10559</usage>`).
 * Editors can use the parsed fields to badge the tool card; the raw content is
 * left intact for the user-facing text.
 */
export interface SubagentMetadata {
    agentId?: string;
    background?: boolean;
    tokens?: number;
    toolUses?: number;
    durationMs?: number;
}
/**
 * Parse sub-agent metadata markers from an Agent/Task result content string.
 * Returns null when no sub-agent markers are present (so non-Agent results
 * short-circuit cheaply). The content may be a JSON string (the backend wraps
 * the result) or plain text — both shapes are handled.
 */
export declare function parseSubagentMetadata(rawContent: unknown): SubagentMetadata | null;
/** Render a turn.failed error object into a readable single-line string. */
export declare function formatTurnError(error: unknown): string;
/**
 * Whether a `turn.failed` error object represents a transient failure worth
 * retrying. Inspects `error.cause` first (the structured root cause), then
 * falls back to the top-level error fields.
 */
export declare function isTransientTurnError(error: unknown): boolean;
/**
 * Whether a `turn.failed` error object means the backend process was lost.
 * Checks the nested cause chain first (real payloads wrap the root cause two
 * levels deep), then the top-level fields.
 */
export declare function isBackendLostError(error: unknown): boolean;
//# sourceMappingURL=tool-helpers.d.ts.map