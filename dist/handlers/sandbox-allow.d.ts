/**
 * Sandbox dynamic-allow flow (ADR-0011).
 *
 * A write outside the Seatbelt whitelist fails inside the sandboxed backend
 * with "Operation not permitted" in the tool output. The bridge extracts the
 * denied path, asks the user via ACP `session/request_permission`
 * (仅此一次 / 始终允许 / 拒绝一次 / 始终拒绝), and on approval kills the backend so the next
 * ensureBackend() respawns under a widened profile. prompt() then chains the
 * continuation inside the original session/prompt request (see session.ts) so
 * the model resumes the interrupted task — per-command seamless escalation is impossible (the
 * executor lives inside the sandbox; profiles are immutable per process),
 * directory-granularity with a restart is the closest achievable form.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ZcodeAcpServer } from "../server.js";
/** A sandbox write-denial observed in tool output. */
export interface SandboxDenial {
    /** The absolute path the OS refused to write (as printed by the tool). */
    path: string;
    /** mkdir-style failures target a directory that does not exist yet — the
     *  path itself is the directory to allow, not its parent. */
    isMkdir: boolean;
}
/** Sentinel for the path-less generic hint's per-session dedup. */
export declare const GENERIC_HINT_KEY = "(generic)";
/**
 * Tools whose output merely ECHOES text — an EPERM string in their output
 * (docs, source, failing-test literals) is not their own syscall failing,
 * and acting on it would raise a phantom ask. Lowercase: the backend
 * reports both "Read" and "read" forms. Unknown names (MCP tools) stay
 * scanned — a custom tool can legitimately hit the sandbox.
 */
export declare const READ_ONLY_TOOLS: Set<string>;
/**
 * Extract the denied path from tool output text (pure; exported for tests).
 * Handles the POSIX tool form (`rm: /a/b: Operation not permitted`), the zsh
 * redirect form (`zsh:2: operation not permitted: /a/b` — lowercase, path
 * AFTER the phrase, the shape every shell redirect denial actually prints),
 * and the Node fs form (`EPERM: operation not permitted, open '/a/b'`).
 * Explicit `./` and `../` relative paths are extracted too and resolved
 * against the session cwd by handleSandboxDenial; bare `foo/bar:` fragments
 * are deliberately not matched. Paths containing spaces or quotes are not
 * matched — the ask falls back to a generic hint.
 */
export declare function extractSandboxDenial(text: string): SandboxDenial | null;
/**
 * How long approvals collect into one restart batch (ADR-0011). The old flow
 * restarted the backend on EVERY approval; a second popup still pending on
 * another denied path was killed by that restart and — worse — its debounce
 * mark permanently muted the re-ask, so the model kept hitting a bare EPERM
 * with no way out. Approvals inside one window now share a single restart
 * and continuation.
 */
export declare const SANDBOX_RESTART_BATCH_MS = 3000;
/**
 * Cooldown before a FAILED ask (timeout, dead channel, killed by another
 * grant's restart) may re-ask the same path. No cooldown at all would storm
 * on instantly-rejecting clients; the old permanent mute left the model
 * hitting a bare EPERM with no way out. A USER decision pins the path
 * forever instead (see handleSandboxDenial).
 */
declare const SANDBOX_ASK_RETRY_MS = 60000;
export { SANDBOX_ASK_RETRY_MS };
/**
 * Collects approved grants and fires ONE flush per batch window. Kept here
 * (not in server.ts) so tests drive the batching against a stub flush
 * without constructing a whole ZcodeAcpServer.
 */
export declare class SandboxRestartBatcher {
    private readonly flush;
    private readonly batchMs;
    private readonly grants;
    private timer;
    constructor(flush: (grants: Map<string, string[]>) => void, batchMs?: number);
    /** Add one approved path for a session; the first add arms the window. */
    add(acpSid: string, grantedReal: string): void;
}
/**
 * What flushSandboxGrants needs from the server (satisfied structurally by
 * ZcodeAcpServer; tests stub it). Keeping the flush standalone makes the
 * cancel-wave / continuation / kill sequencing unit-testable without a
 * whole server.
 */
export interface SandboxFlushTarget {
    cancelAllPendingTurns(): void;
    readonly sandboxContinuations: Map<string, string>;
    /** acpSid → live zcode session id. */
    readonly sessionMap: Map<string, string>;
    /** In-flight turns; entries are deleted when the turn's prompt returns. */
    readonly pendingTurns: Map<number | string, {
        zcodeSid: string;
        cancelled?: boolean;
        goalLoop?: boolean;
        sandboxRestart?: boolean;
    }>;
    /** The backend to close; the flush nulls it (respawn stays lazy). */
    backend: {
        close(): Promise<void>;
        readonly isDead: boolean;
    } | null;
}
/**
 * One batched sandbox allow-restart (ADR-0011; driven by
 * SandboxRestartBatcher): cancel every in-flight turn — they share the
 * backend and would otherwise hang on the dead reader — queue one
 * continuation per session listing ALL granted paths, and close the backend
 * once. The next ensureBackend() respawns under the widened profile
 * (persisted config entries + bridge-lifetime once-allows).
 */
export declare function flushSandboxGrants(target: SandboxFlushTarget, grants: Map<string, string[]>): void;
/**
 * Extract the path from an ordinary filesystem-permission failure (EACCES —
 * "Permission denied"), as printed by POSIX tools (`ls: /a/b: Permission
 * denied`) and zsh redirects (`zsh:1: permission denied: /a/b`). Unlike a
 * sandbox EPERM the bridge can never "allow" this — no popup fixes chmod or
 * ownership — so the turn loop surfaces it as a one-time hint instead of
 * raising an ask. Same boundary rules as extractSandboxDenial: explicit ./
 * and ../ relative paths are returned as-is (resolved by the caller), bare
 * relative fragments and quoted paths are not matched.
 */
export declare function extractPermDeniedPath(text: string): string | null;
/**
 * Paths that no popup can ever allow: the deny island (config self-edit =
 * self-escalation) and strictGit's .git — their denies are emitted LAST in
 * the profile (SBPL last-match), so an allow line can never override them.
 * Offering the popup there would just white-flash and dead-end.
 */
export declare function protectedSandboxPaths(cwdRoots: Iterable<string>): string[];
/**
 * Ask the user to allow the directory behind a sandbox denial and, on
 * approval, queue the grant into the batched restart (see
 * SandboxRestartBatcher — one restart per window, not one per approval).
 * Best-effort: any failure keeps the sandbox exactly as it was.
 */
export declare function handleSandboxDenial(server: ZcodeAcpServer, cx: acp.AgentContext, acpSid: string, denial: SandboxDenial, toolCallId: string): Promise<void>;
//# sourceMappingURL=sandbox-allow.d.ts.map