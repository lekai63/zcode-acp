/**
 * Shared utilities: logging and project-wide constants.
 *
 * Logging goes to stderr so it never corrupts the stdout ACP protocol stream.
 */
/** ACP protocol version this server speaks. */
export declare const PROTOCOL_VERSION = 1;
/** Agent identity advertised in the initialize response. */
export declare const AGENT_INFO: {
    readonly name: "zcode-acp-server";
    readonly title: "ZCode";
    readonly version: string;
};
/**
 * Root of the ZCode data directory. `ZCODE_HOME` replaces `~/.zcode` outright,
 * so a bridge can run against an isolated ZCode install (a second account, a
 * container mount, a test fixture) without touching the user's real one.
 * Resolved at call time so a caller can change the env before reading.
 */
export declare function zcodeHomeDir(): string;
/**
 * Path to the ZCode v2 config (credentials + provider/model metadata).
 * Module-level snapshot: `ZCODE_HOME` must be set before the process starts.
 */
export declare const ZCODE_CREDS_PATH: string;
/**
 * Path to the ZCode CLI config (skills/plugins/MCP enablement). Per call, so
 * discovery follows a `ZCODE_HOME` change made after import (tests).
 */
export declare function zcodeCliConfigPath(): string;
/** Root of the ZCode plugin cache directory (per call — see above). */
export declare function zcodePluginCacheDir(): string;
/**
 * Slash commands surfaced to the editor. Each maps to a ZCode session method
 * that the server forwards when the user types the command.
 *
 * Commands handled by the bridge (compact/goal/fork/model/mode/thought/quota/
 * mcp) are intercepted in `handleSlashCommand`. Commands handled by the ZCode
 * backend (init) and plugin commands (code-review etc.) pass through to
 * `session/send` — the backend resolves them before the model.
 *
 * Discovered Skills (arco-design, tdd, etc.) are also appended to the command
 * list at startup via `buildAllCommands()` — they pass through as normal text
 * and the model resolves them via its `Skill` tool.
 */
export declare const SLASH_COMMANDS: readonly [{
    readonly name: "auto";
    readonly description: "Autonomous loop: start, status, pause, resume, stop";
    readonly input: {
        readonly hint: "<objective> | status | pause | resume | stop";
    };
}, {
    readonly name: "compact";
    readonly description: "Compress conversation context (free up tokens)";
}, {
    readonly name: "goal";
    readonly description: "Set or show the session goal";
    readonly input: {
        readonly hint: "goal description";
    };
}, {
    readonly name: "fork";
    readonly description: "Fork the session at the latest checkpoint";
}, {
    readonly name: "mode";
    readonly description: "Switch permission mode (plan/build/edit/yolo)";
    readonly input: {
        readonly hint: "plan|build|edit|yolo";
    };
}, {
    readonly name: "model";
    readonly description: "Switch the session model";
    readonly input: {
        readonly hint: "GLM-5.3|GLM-5.2|GLM-5-Turbo";
    };
}, {
    readonly name: "thought";
    readonly description: "Set the reasoning effort";
    readonly input: {
        readonly hint: "low|high|max";
    };
}, {
    readonly name: "quota";
    readonly description: "Show remaining usage quota (5h / weekly / MCP)";
}, {
    readonly name: "resume";
    readonly description: "Resume a past session into this thread (picker popup)";
}, {
    readonly name: "mcp";
    readonly description: "List available MCP servers";
}, {
    readonly name: "init";
    readonly description: "Create or update workspace AGENTS.md instructions";
}];
/** Static metadata for the configOptions selects (model/mode/thought). */
export declare const CONFIG_META: {
    readonly model: {
        readonly name: "Model";
        readonly category: "model";
        readonly options: Array<{
            value: string;
            name: string;
        }>;
    };
    readonly mode: {
        readonly name: "Mode";
        readonly category: "mode";
        readonly options: readonly [{
            readonly value: "plan";
            readonly name: "plan";
        }, {
            readonly value: "build";
            readonly name: "build";
        }, {
            readonly value: "edit";
            readonly name: "edit";
        }, {
            readonly value: "yolo";
            readonly name: "yolo";
        }, {
            readonly value: "auto";
            readonly name: "auto";
        }];
    };
    readonly thought: {
        readonly name: "Thought Level";
        readonly category: "thought_level";
        readonly options: readonly [{
            readonly value: "low";
            readonly name: "low";
        }, {
            readonly value: "high";
            readonly name: "high";
        }, {
            readonly value: "max";
            readonly name: "max";
        }];
    };
};
/** configId → zcode method + param key (model deliberately absent — switch via runtimeModel). */
export declare const CONFIG_DISPATCH: Record<string, {
    method: string;
    paramKey: string;
}>;
/** Verbose diagnostic log. Only emitted when `ZCODE_ACP_DEBUG=1`. */
export declare function log(msg: string): void;
/** Warning — always emitted. For perceivable failures. */
export declare function warn(msg: string): void;
/**
 * Stable identity of an ACP client connection. Each request wraps the
 * connection in a fresh AgentContext, so the wrappers never compare equal —
 * `connectionContext` is the SDK's per-connection root (public at runtime,
 * @internal in the typings, hence the cast). `ctx.client` from a handler is
 * one such wrapper; two requests from the same editor/TUI/app share the root.
 */
export declare function clientConnectionRoot(client?: unknown): unknown;
/**
 * Compare two semver-like version strings numerically (e.g. "10.0.0" > "2.0.0").
 * Falls back to lexicographic comparison for non-numeric segments. Used by
 * plugin/skill/MCP discovery to find the latest cached version directory.
 *
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export declare function compareVersions(a: string, b: string): number;
//# sourceMappingURL=utils.d.ts.map