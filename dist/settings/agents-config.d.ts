/**
 * Sub-agent configuration: the agent definitions plus the state file.
 *
 * Two stores, two different jobs:
 *
 *  - `~/.zcode/agents/<name>.md` — the agent itself: YAML frontmatter plus a
 *    system-prompt body.
 *  - `~/.zcode/v2/agents-state.json` — enablement and model overrides. Built-in
 *    agents have no file at all, so their model override can ONLY live here.
 *
 * Scope of this module is deliberately narrow (ADR for the settings API):
 * frontmatter fields the app's own form exposes as first-class inputs
 * (`name`, `description`, `color`, `model`, `thoughtLevel`), plus create /
 * delete / enable. The system-prompt body and the advanced lists (tools,
 * skills, permissionMode, maxTurns, …) are NOT exposed — a body round-trip
 * through JSON risks silent whitespace and escaping damage, and those fields
 * are rare enough that editing the file directly is the better experience.
 *
 * Consequences of that split, which callers must know:
 *
 *  - Creating an agent writes a minimal template body; a user who wants a real
 *    prompt edits the file (or the app opens it in an editor).
 *  - Editing an agent REWRITES its frontmatter from the parsed model, so any
 *    advanced field the user set by hand is preserved verbatim in the body of
 *    the file but its frontmatter keys are re-emitted in canonical order.
 */
/** The eight colors the app's picker offers. */
export declare const AGENT_COLORS: readonly ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"];
export type AgentColor = (typeof AGENT_COLORS)[number];
/** Agents the app ships and forbids editing. */
export declare const BUILT_IN_AGENTS: readonly ["general-purpose", "Explore"];
/**
 * A user-scope agent id is `user:<lowercased name>` — the spelling the state
 * file's `disabledAgentIds` uses.
 */
export declare function agentStateId(name: string): string;
/** File name for an agent: lowercased name + `.md`. */
export declare function agentFileName(name: string): string;
export declare function isValidAgentName(name: string): boolean;
export interface AgentModelSelection {
    providerId: string;
    modelId: string;
    thoughtLevel?: string;
}
/** The frontmatter fields this module reads and writes. */
export interface AgentFrontmatter {
    name: string;
    description: string;
    color?: string;
    model?: string;
    thoughtLevel?: string;
    /** Everything else in the file, preserved verbatim on rewrite. */
    [key: string]: unknown;
}
export interface AgentEntry {
    /** Lowercased name — the stable identity. */
    name: string;
    fileName: string;
    path: string;
    frontmatter: AgentFrontmatter;
    /** Body text, exposed read-only so a client can show it. */
    systemPrompt: string;
    /** From the state file: disabled agents are excluded from the runtime. */
    enabled: boolean;
    /** Built-in agents cannot be edited or deleted. */
    readOnly: boolean;
    /** Resolved model override, when one is set. */
    modelSelection?: AgentModelSelection;
}
export interface AgentsStateFile {
    builtInModelSelectionOverrides?: Record<string, AgentModelSelection>;
    pluginAgentModelSelectionOverrides?: Record<string, AgentModelSelection>;
    disabledAgentIds?: string[];
    [key: string]: unknown;
}
/** Read the state file; absent → an empty document. */
export declare function readAgentsState(): Promise<AgentsStateFile>;
/**
 * Enable or disable a user-scope agent.
 *
 * Only `user:` agents can be disabled — built-ins have no disable record (the
 * app's `attachEnabledState` ignores any other scope), and a plugin agent's
 * enablement belongs to its plugin.
 */
export declare function setAgentEnabled(name: string, enabled: boolean): Promise<AgentsStateFile>;
/**
 * Set a built-in agent's model override.
 *
 * This is the ONLY way a built-in agent's model can change: it has no markdown
 * file, so the override lives in the state file. `undefined` clears it, which
 * restores inheritance from the workspace default.
 */
export declare function setBuiltInAgentModel(name: string, selection: AgentModelSelection | undefined): Promise<AgentsStateFile>;
/**
 * Split a markdown file into its frontmatter block and body.
 *
 * Exported for the round-trip tests, which are the only place the parser and
 * the serializer are exercised as a pair.
 */
export declare function splitFrontmatter(content: string): {
    frontmatter: string;
    body: string;
} | null;
/**
 * Parse frontmatter with the same loose semantics the runtime uses.
 *
 * YAML first, then line-level key/value with bracket-list support. The runtime * deliberately accepts non-strict frontmatter so a hand-written file still
 * loads; reading with the same rules keeps a file the CLI accepted visible here
 * instead of silently missing from the list.
 */
export declare function parseFrontmatter(block: string): Record<string, unknown>;
/**
 * Serialize an agent file.
 *
 * Mirrors the app's writer: `name` and `description` are always quoted, scalars
 * are emitted only when set, lists as YAML block sequences, and the body
 * follows the closing `---`. Unknown frontmatter keys are re-emitted after the
 * known ones so a hand-added field survives an edit.
 */
export declare function serializeAgentMarkdown(frontmatter: AgentFrontmatter, body: string): string;
/**
 * Every agent: the built-ins, then the user-scope markdown files, each with its
 * enablement and model override resolved from the state file.
 */
export declare function listAgents(): Promise<AgentEntry[]>;
/**
 * Create an agent file.
 *
 * Refuses to overwrite (the app's own create uses the `wx` flag for the same
 * reason) and seeds a minimal body so the agent is immediately usable.
 */
export declare function createAgent(input: {
    name: string;
    description: string;
    color?: string;
    model?: string;
    thoughtLevel?: string;
}): Promise<AgentEntry>;
/**
 * Update an agent's editable frontmatter fields.
 *
 * Only the fields present in `patch` change; the body and every other
 * frontmatter key are carried through from the file. `model`/`thoughtLevel`
 * accept `null` to CLEAR the key (the app's "inherit" choice). Renaming is a
 * delete + create, which is why it is NOT offered here — a rename would orphan
 * the state file's disable record.
 */
export declare function updateAgent(name: string, patch: {
    description?: string;
    color?: string;
    model?: string | null;
    thoughtLevel?: string | null;
}): Promise<AgentEntry>;
/** Delete a user-scope agent file. */
export declare function deleteAgent(name: string): Promise<void>;
/** The ZCode data root, for tests and diagnostics. */
export declare function agentsRoot(): string;
//# sourceMappingURL=agents-config.d.ts.map