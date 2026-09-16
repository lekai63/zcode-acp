/**
 * Terminal tab/window titles for TUI-hosted bridges (martty).
 *
 * martty never emits a terminal title, so a CLI-launched or hub-incubated
 * window keeps whatever the shell last set — usually the command name — and a
 * user with several windows cannot tell conversations apart. The bridge runs
 * under martty in the same process group, so it shares the terminal's
 * controlling tty and can name the tab itself with an OSC 0 sequence (the
 * same escape the hub's TUI script prints at incubation time; this module
 * keeps it live as the session gains a real title).
 *
 * Gated on `marttyClientSeen`: only a bridge spawned by a martty may write.
 * A Zed extension host CAN have a controlling tty (Zed launched from a
 * shell) — writing there would hijack an unrelated terminal's title, so
 * non-martty bridges never write. Writes are rare (title lifecycle events,
 * ~40 bytes) and OSC output is terminal chrome, not screen content, so they
 * cannot corrupt martty's drawing beyond a single self-healing frame.
 */
import type { ZcodeAcpServer } from "./server.js";
/**
 * Strip everything a terminal title must not carry: C0/C1 controls and DEL
 * (an embedded ESC or BEL could inject escape sequences; BEL also terminates
 * the OSC string early), collapse whitespace runs, trim, cap.
 */
export declare function sanitizeTitle(raw: string): string;
/** Injection seam for tests: write the OSC 0 sequence somewhere. */
export interface TitleIo {
    write(sequence: string): boolean;
}
/**
 * The production writer: /dev/tty is the controlling terminal regardless of
 * where stdout/stderr point (both are pipes to martty). Never throws — any
 * failure means "no title support here" and is silently ignored. Also a hard
 * no-op under vitest: a developer's test run shares their real terminal, and
 * titles flashing by during `pnpm test` would be obnoxious.
 */
export declare const ttyTitleIo: TitleIo;
/**
 * The tab title for a session: `<project> · <topic>` once a conversation
 * title is known (auto-title, adopted stored title, or rename), else the
 * project directory name alone. The project is the folder basename, capped at
 * PROJECT_MAX chars (ellipsis on cut) so an unwieldy dir name cannot crowd
 * out the topic; when the combined title would exceed TITLE_MAX the TOPIC is
 * trimmed to fit — the project anchors which window this is, the topic is
 * the freshest information. The hub's incubation script builds the same
 * string (ZCODE_ACP_TAB_TITLE), so the title never churns when the bridge
 * takes over from the script's initial printf.
 */
export declare function sessionTabTitle(title: string | undefined, cwd: string | undefined): string;
/**
 * Push the current session title to the terminal tab (martty-hosted bridges
 * only — see the module doc for why the gate is mandatory).
 */
export declare function refreshTerminalTabTitle(server: ZcodeAcpServer, acpSid: string, io?: TitleIo): boolean;
//# sourceMappingURL=terminal-title.d.ts.map