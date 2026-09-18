#!/usr/bin/env node
/**
 * Standalone CLI for querying GLM Coding Plan usage — a thin wrapper over the
 * same `queryQuota()` + `formatQuotaPlain()` the `/quota` slash command uses.
 *
 * No ACP server, no zcode subprocess: only reads `~/.zcode/v2/config.json` for
 * credentials and hits the quota HTTP API directly.
 *
 * Usage:
 *   zcode-acp quota                  one-shot: print the card and exit
 *   zcode-acp quota -w               watch mode (default 30s refresh)
 *   zcode-acp quota -w -i 60         watch with a 60s interval
 *   zcode-acp quota -d               show per-model MCP detail sub-lines
 *   zcode-acp quota --watch --interval 15
 *   zcode-acp quota -h | --help      show help
 *
 * The refresh interval has a 10s floor: the in-memory quota cache TTL is 10s,
 * and a shorter interval would just keep returning the cached value.
 */
import { type Provider } from "../quota/combined.js";
/** Parsed CLI options. Exported for unit testing. */
export interface CliOptions {
    watch: boolean;
    intervalMs: number;
    /** True when the user-supplied interval was below the 10s floor and raised. */
    intervalClamped: boolean;
    /** True when the user wants per-model MCP detail sub-lines shown. */
    detail: boolean;
    help: boolean;
    /** Which provider(s) to query — first positional arg (`glm`/`go`/`oc`), else `all`. */
    provider: Provider;
    /** True when the user explicitly asked for the plain monochrome layout. */
    plain: boolean;
}
/**
 * Clamp a raw interval (seconds, optional) to a valid ms value. Returns the
 * clamped value plus whether a user-supplied value was raised to the floor.
 *
 * Exported for unit testing.
 */
export declare function resolveIntervalMs(seconds: number | undefined): {
    ms: number;
    clamped: boolean;
};
/**
 * Parse argv into {@link CliOptions}. Supports `-w`/`--watch`, `-h`/`--help`,
 * `-i <n>`/`--interval <n>` (space), `--interval=<n>`, and `-i<n>` (attached).
 * The first non-flag positional arg is the provider (`glm`/`go`); any other
 * value is ignored (treated as `all`). Unknown flags are ignored.
 *
 * Exported for unit testing.
 */
export declare function parseArgs(argv: readonly string[]): CliOptions;
/**
 * CLI entry. Takes the argument list (defaulting to the process argv) so the
 * Unified CLI dispatcher can pass its own slice (`zcode-acp quota -w` →
 * `["-w"]`) without the subcommand name leaking in as a provider token.
 *
 * Exported for the Unified CLI dispatcher; guarded auto-run below.
 */
export declare function main(argv?: readonly string[]): Promise<void>;
//# sourceMappingURL=quota.d.ts.map