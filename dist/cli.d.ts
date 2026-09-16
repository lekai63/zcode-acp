#!/usr/bin/env node
/**
 * Unified CLI entry (`zcode-acp`). Every operational surface is a subcommand;
 * bare invocation opens the interactive Martty TUI (ADR-0020). See docs/adr
 * 0007 for why the old `zcode-acp-hub` / `zcode-quota` bins were folded in
 * here and why `zcode-acp-server` remains as a bin alias pointing at this
 * same file.
 *
 * The legacy alias is detected via argv[0]: npm/pnpm install bin names as
 * symlinks, so both `zcode-acp` and `zcode-acp-server` resolve to dist/cli.js
 * while Node keeps the invoked path in argv — basename tells us which name the
 * user (or editor config) actually typed.
 */
/** What the dispatcher decided to run. `args` are the tokens after the subcommand. */
export type Invocation = {
    kind: "help";
} | {
    kind: "tui";
    explicit: boolean;
    check: boolean;
} | {
    kind: "server";
} | {
    kind: "serve";
} | {
    kind: "hub";
} | {
    kind: "quota";
    args: string[];
} | {
    kind: "unknown";
    sub: string;
};
/**
 * Map (invoked name, argv) to a subcommand. Pure — exported for unit tests.
 *
 * `invokedAs` is basename(argv[1]); `zcode-acp-server` means we were spawned
 * by an editor config that expects the bridge to speak ACP on stdio with no
 * subcommand prefix. Bare `zcode-acp` opens the interactive Martty TUI;
 * `repl` stays accepted as the old spelling of `tui`.
 */
export declare function resolveInvocation(invokedAs: string, argv: readonly string[]): Invocation;
//# sourceMappingURL=cli.d.ts.map