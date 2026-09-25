/**
 * Login-shell environment completion for remotely-spawned processes.
 *
 * A bridge started from an editor (Zed, JetBrains) inherits launchd's
 * environment — a bare PATH with no version managers in it. The hub is a
 * detached daemon spawned by that bridge, so it inherits the same, and every
 * process IT spawns (a terminal TUI window, a serve bridge, the zcode backend)
 * inherits it again. The result is that a session opened from a phone cannot
 * find `pnpm`, `cargo`, `java` or anything else the user's interactive shell
 * provides, even though the same command works perfectly in a terminal.
 *
 * The fix is to ask a LOGIN shell for its environment once and cache it: the
 * user's rc files are where mise/nvm/homebrew/rbenv install their PATH entries,
 * and `env -0` prints that environment NUL-separated — the only format that
 * survives a value containing a newline.
 *
 * The probe shell is deliberately NON-INTERACTIVE. An interactive shell (`-i`)
 * arms interactive-only machinery — job control, zle, prompt setup, terminal
 * modes — inside a process that merely wants a value back, and several of the
 * user's own rc tools (compinit, autosuggestions, syntax-highlighting, orbstack)
 * are written for a terminal it does not have. This probe runs inside a
 * terminal-owning process tree (a martty window's bridge), so an interactive
 * child is exactly the wrong thing to start there. The rc file that carries the
 * toolchain paths (`~/.zshrc`) is sourced EXPLICITLY instead, which is all the
 * paths need and none of the interactive state.
 *
 * The probe is ASYNC on purpose (the same invariant as the hub's terminal
 * spawn): a synchronous probe freezes the calling process's event loop for its
 * full timeout — on the hub that stalls WS proxying, heartbeats and settings
 * requests for every attached client. Callers therefore await
 * `envWithLoginShell`; the in-flight probe is shared, so concurrent callers
 * block on ONE child instead of each starting their own.
 *
 * Caching: a success is cached for the process lifetime (the value cannot
 * change without the user editing their rc); a FAILURE is remembered for a
 * 60s cooldown, so a machine whose rc hangs or whose shell exits non-zero
 * degrades to the inherited environment immediately instead of re-paying the
 * timeout on every incubation/backend spawn.
 *
 * Failure is silent and non-fatal: a machine with no `zsh`, a shell that hangs,
 * or a user with no rc files all fall back to the inherited environment, which
 * is exactly today's behaviour. Nothing here may throw.
 */
/**
 * `env` plus whatever the login shell knows that it does not.
 *
 * The caller's own values win for every variable EXCEPT `PATH`, which is
 * unioned: a bridge launched by an editor inherits launchd's bare PATH, and if
 * that bare value simply won, the user's toolchain dirs would never be added —
 * which is the entire point of this probe. Process-plumbing vars
 * (`ZCODE_ACP_*`, `DSH_TUI_*`, `MARTTY_*`) are never taken from the login
 * shell: they describe THIS process tree, and a stale copy in the user's rc
 * would hijack a spawned session into the wrong origin.
 */
export declare function envWithLoginShell(env?: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv>;
/** Test seam: drop the caches so the next call re-probes. */
export declare function resetLoginShellEnvForTest(): void;
//# sourceMappingURL=login-shell-env.d.ts.map