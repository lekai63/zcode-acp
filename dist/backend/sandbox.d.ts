/**
 * Seatbelt sandbox for the zcode backend subprocess (ADR-0011).
 *
 * The backend runs every Bash/Edit/Write tool with the user's full
 * privileges; one careless command destroys real data. The bridge wraps the
 * single backend spawn point with a generated `sandbox-exec` profile using a
 * writes-only restriction model: reads and process execution stay open, file
 * writes are denied everywhere except an explicit whitelist. Children inherit
 * the sandbox, so one wrap covers the backend, its tool subprocesses, and
 * model workers — deletion (rm/mv/truncate) is a write-class syscall, so it
 * is stopped by the write denial regardless of which binary performs it
 * (name-banning executables would be trivially bypassed and is deliberately
 * not done).
 *
 * Arming is dual-switch (see sandboxActive): ZCODE_ACP_SANDBOX=1 forces it
 * globally, or a workspace opts in via `enabled: true` in its own
 * .zcode/acp/sandbox.json — the template is auto-created with enabled:false,
 * so opting in is always an explicit user edit.
 *
 * Whitelist (frozen at spawn, rebuilt on backend restart):
 * - workspace roots of all live sessions (union of server.sessionCwds)
 * - `~/.zcode*` (the backend's own sessions/db/logs — not agent privilege;
 *   denying it breaks session/create itself)
 * - system temp + regenerable cache dirs (zero-value targets, constant
 *   toolchain traffic)
 * - each project's `.zcode/acp/sandbox.json` `allow` list
 * - bridge-lifetime once-allows granted via the dynamic allow flow
 *
 * `<workspace>/.zcode/acp/` is a DENY island inside every allowed workspace:
 * the sandbox forbids writes there while the bridge — outside the sandbox —
 * persists "always allow" entries on the user's behalf. The agent cannot
 * edit its own allowlist.
 *
 * macOS-only: Seatbelt is a macOS facility. Setting the env elsewhere warns
 * once and runs unsandboxed (see sandboxActive()).
 */
/** The one and only env switch. Every other knob is project config. */
export declare const SANDBOX_ENV = "ZCODE_ACP_SANDBOX";
export interface SandboxConfig {
    /**
     * Project-level switch: true arms the sandbox for this workspace without
     * the global env. The auto-created template ships false — opting in is an
     * explicit user edit.
     */
    enabled: boolean;
    /** Absolute realpaths OUTSIDE the workspace granted permanent write. */
    allow: string[];
    /**
     * Absolute realpaths the user chose NEVER to grant ("永不放行") — the
     * popup is suppressed for these. Visible config, not hidden memory: the
     * user can review or undo a denial by editing this file.
     */
    deny: string[];
    /** true = .git sits behind the allow popup instead of default-writable. */
    strictGit: boolean;
}
/** Path of the per-project sandbox config inside a workspace root. */
export declare function sandboxConfigPath(workspaceRoot: string): string;
/**
 * Read the project sandbox config, auto-creating the template (enabled:
 * false) on first touch so the user finds the file and can flip the switch —
 * the PRESENCE of the file is never the switch, only `enabled` is, so the
 * auto-create cannot arm anything by itself. A malformed or non-object file
 * falls back to enabled:true WITHOUT rewriting it: corruption must fail
 * CLOSED (the user opted in; losing that to a half-saved file would silently
 * disarm), and clobbering the user's mid-edit bytes with a template would be
 * worse than the transient read. A symlinked/hardlinked config is treated
 * the same way (armed, persistence disabled) — see configIntegrityOk. So is
 * a config that was armed and then became unreadable or disappeared — only
 * the agent could do that from inside the sandbox.
 */
export declare function readSandboxConfig(workspaceRoot: string): SandboxConfig;
/**
 * Bridge-side persistence for "always allow" (the deny island keeps the
 * agent from writing this file itself). Round-trips the whole config so the
 * enabled flag survives the write. Dedupes by exact string. Returns false
 * when persistence is impossible (symlinked config, unwritable path) — the
 * caller then downgrades to a bridge-lifetime once-allow.
 */
export declare function appendSandboxAllow(workspaceRoot: string, allowedPath: string): boolean;
/**
 * Bridge-side persistence for the popup's "永不放行" choice — the visible
 * counterpart of appendSandboxAllow: a denied path is RECORDED in the
 * config (never hidden in bridge memory), so the ask never resurfaces for
 * it and the user can review or undo the decision by editing the file.
 */
export declare function appendSandboxDeny(workspaceRoot: string, deniedPath: string): boolean;
/**
 * Resolve a path to its filesystem truth. Seatbelt matches real paths, so a
 * symlinked prefix (/tmp → /private/tmp) would silently fail to match —
 * resolve what exists and append the (possibly not-yet-created) remainder.
 */
export declare function resolveReal(p: string): string;
export interface SandboxArmInput {
    /** Workspace roots (already real) with their per-project configs. */
    workspaces: Array<{
        root: string;
        config: SandboxConfig;
    }>;
    /** Extra writable roots: allowlists from other workspaces + once-allows. */
    extraAllow: string[];
    /**
     * Directory the profile file itself lives in — self-denied LAST so the
     * sandboxed agent cannot race/symlink/occupy the next respawn's profile
     * (see armSandboxArgv). $TMPDIR is agent-writable, so without this the
     * profile path would be attacker-reachable.
     */
    profileDir?: string;
    /**
     * Managed root under which every profile dir lives (`~/.zcode-acp/sandbox/`).
     * Denied in full: no sandboxed generation may touch ANY profile, its own or
     * another bridge's — same placement invariant the profileDir deny provides,
     * covering the whole centralized tree.
     */
    profilesRoot?: string;
}
/**
 * Build the SBPL profile text. SBPL resolves overlapping rules by LAST
 * match (verified empirically: an allow emitted after a deny re-permits the
 * write), so the layout is: base deny-all, then every allow, then the deny
 * carve-outs (island, strictGit) LAST so nothing can override them.
 */
export declare function buildSandboxProfile(input: SandboxArmInput): string;
/** Resolved arm input for the CURRENT spawn: union of all live workspaces. */
export declare function collectSandboxWorkspaces(cwdRoots: Iterable<string>): {
    workspaces: Array<{
        root: string;
        config: SandboxConfig;
    }>;
    extraAllow: string[];
};
/**
 * The project-level switch: `enabled: true` inside the workspace's sandbox
 * config (auto-created on first touch, template ships false). Reading also
 * materializes the template for discovery. Once the sandbox is armed the
 * deny island keeps the agent from flipping the switch back off.
 */
export declare function projectSandboxEnabled(workspaceRoot: string): boolean;
/**
 * Whether the sandbox should arm for this bridge: ZCODE_ACP_SANDBOX=1
 * (global, cached) OR any given workspace root opted in via
 * sandbox.json `enabled` (project switch, re-checked per call so a flip
 * mid-run is seen). macOS-only: elsewhere a requested sandbox warns once and
 * runs unsandboxed.
 */
export declare function sandboxActive(roots?: Iterable<string>): boolean;
/** Test hook: reset cached decisions and warn-once sets. */
export declare function resetSandboxDecisionForTest(): void;
/** Managed root for all sandbox profile dirs — centralized, sweepable. */
export declare function sandboxProfilesRoot(): string;
/**
 * Arm a backend argv: build the profile into a FRESH unpredictable dir under
 * `~/.zcode-acp/sandbox/` and wrap with sandbox-exec. The managed root is
 * OUTSIDE every whitelisted path (the profile allows ~/.zcode* state dirs,
 * caches, and temp trees — never ~/.zcode-acp), which is the load-bearing
 * defense: $TMPDIR and the cache dirs are agent-writable, and a PRIOR
 * sandboxed generation (a setsid survivor of the old process group) keeps its
 * own profile's allows — so a profile placed there could be raced, symlinked,
 * FIFO'd, or occupied no matter how fresh its name (reproduced across
 * generations even with mkdtemp + O_EXCL + a self-deny, which each generation
 * only applies to its own dir). The agent can also kill the backend at will
 * (signals are not file-writes) to control respawn timing; with the profile
 * unreachable from ANY generation, that primitive buys nothing. O_EXCL ("wx")
 * additionally refuses pre-placed symlinks from a pre-arming process, the
 * profile denies the whole profiles root last, and the self-deny of its own
 * dir remains as defense in depth for the workspace-root-is-$HOME edge (where
 * home itself is writable).
 */
export declare function armSandboxArgv(argv: string[], input: SandboxArmInput): string[];
//# sourceMappingURL=sandbox.d.ts.map