/**
 * Hub daemon — machine-level singleton for remote access.
 *
 * The hub is the ONLY public entry point (the port a tunnel maps). It does
 * token auth, instance discovery, and byte-level WebSocket proxying from a
 * remote client to one bridge's loopback ACP endpoint (ADR-0002), plus two
 * plain-HTTP conveniences that spare clients a full ACP round-trip (ADR-0005):
 * a proxied per-instance /status, and an account-level /api/quota queried
 * directly (quota belongs to the machine's credentials, not to any instance).
 * POST /api/upgrade lets a client TRIGGER a self-decided restart: the hub
 * re-checks whether the on-disk build is newer than the running process and,
 * only if so, re-spawns itself onto it — the decision is never the client's.
 * It holds no session state and understands no ACP — a proxied connection
 * stays bound to one instance for its whole lifetime.
 *
 * Bridges register via POST /api/register every 10s (the registration doubles
 * as the heartbeat; entries older than the heartbeat TTL are pruned). A client
 * that needs an immediately-honest list (e.g. a phone app's pull-to-refresh)
 * passes ?probe=1 to /api/instances: the hub TCP-probes each registered
 * loopback port and prunes unreachable bridges before answering — no periodic
 * probing, the cost is paid only when someone refreshes. When no instance is
 * registered and no proxy is active for `idleExitMs`, the hub re-reads the
 * user config LIVE: remote still enabled → stays resident (phone-driven
 * create/resume must work with zero local bridges); disabled → exits, and the
 * next bridge re-spawns it on demand.
 */
import { type ChildProcess } from "node:child_process";
import type { TerminalPrefs } from "../config/user-config.js";
export interface HubOptions {
    port: number;
    host: string;
    token: string;
    /** Registration TTL before an instance is pruned (default 30s). */
    heartbeatTimeoutMs?: number;
    /**
     * How long an instance must stay probe-unreachable before ?probe=1 prunes it
     * (default 8s). A single failed probe only marks it unhealthy — a busy
     * bridge's event loop can stall past the connect timeout while fully alive.
     */
    probeGraceMs?: number;
    /** Idle time with zero instances and zero proxies before exit (default 10min). */
    idleExitMs?: number;
    /** WebSocket keepalive ping interval (default 30s; tunnels drop idle links). */
    pingIntervalMs?: number;
    /**
     * How long a visible-terminal incubation (session-create/-resume) waits for
     * the spawned bridge's registration (default TUI_REGISTER_TIMEOUT_MS; tests
     * shrink it).
     */
    tuiRegisterTimeoutMs?: number;
    /**
     * Fires when the hub decided it should restart onto newer on-disk code
     * (a newer bridge registered, or POST /api/upgrade found the dist newer).
     * The standalone daemon re-spawns a replacement before exiting (see
     * bin/hub.ts); falls back to onIdleExit when unset.
     */
    onRestart?: () => void;
    /**
     * Override the on-disk locations /api/upgrade checks against (tests point
     * these at fixtures). Defaults: this package's package.json and the dist
     * directory this module runs from.
     */
    codePaths?: {
        packageJson: string;
        distDir: string;
    };
    /**
     * Override the frozen content fingerprint this hub compares bridges and
     * /api/upgrade against (tests inject fixtures). Default: read from the
     * code-fingerprint.json next to this module's dist root; null in dev/src.
     */
    hubFingerprint?: string | null;
    /**
     * Override where the remote session-create endpoints read the known-project
     * whitelist from (tests point this at a fixture sqlite). Default: the App's
     * tasks-index.sqlite (see listKnownWorkspaces).
     */
    projectsDbPath?: string;
    /**
     * Override the idle-exit stay-alive check (tests pin it). Default: live
     * re-read of the user config (remoteEnabledLive) — remote still enabled
     * means the hub stays resident so a phone can create/resume at any time;
     * only an explicit disable retires the daemon.
     */
    stayAliveCheck?: () => boolean;
    /**
     * Override how the remote session-create / session-resume endpoints spawn
     * a bridge (tests inject a fake). Default: this node + this package's
     * dist/cli.js — an interactive TUI in a visible terminal for
     * session-create and session-resume ("tui"; resume carries the requested
     * session in ZCODE_ACP_RESUME_SESSION), a detached headless serve bridge
     * for background queries ("serve"). A "tui" attempt returns null when the
     * launch fails; the caller then walks down the terminal preference list
     * (terminalLaunches) and only spawns "serve" once every entry failed.
     */
    spawnServe?: (opts: {
        cwd: string;
        env: NodeJS.ProcessEnv;
        /** "tui" = visible terminal (session-create/-resume); "serve" = detached headless. */
        kind: "tui" | "serve";
        /** The resolved launch for a "tui" attempt (one list entry). */
        launch?: TerminalLaunch;
    }) => ChildProcess | null | Promise<ChildProcess | null>;
    /**
     * Override the ordered terminal preference list the create/resume
     * incubation walks (tests inject fixed entries). Default: resolved LIVE
     * per incubation from remoteTerminalPrefs (config file > env), so editing
     * the file takes effect without a hub restart.
     */
    terminalLaunches?: TerminalLaunch[];
    /**
     * How long after startup the hub ignores newer-bridge stale votes (tests
     * shrink to 0). Default STALE_VOTE_COOLDOWN_MS — the loop breaker so a
     * same-age respawn can never be voted into a restart churn.
     */
    staleVoteCooldownMs?: number;
}
export interface HubHandle {
    port: number;
    close(): Promise<void>;
}
/** How the hub hands the .command script to a terminal (ADR-0016). */
export type TerminalLaunch = 
/** ZCODE_ACP_HUB_TERMINAL_COMMAND: a shell command; `{script}` (if present)
 * is replaced by the quoted script path, else the path is appended. */
{
    kind: "shell";
    command: string;
}
/** `.command`-executing apps (Terminal, iTerm): `open -a <app> <script>`. */
 | {
    kind: "openApp";
    app: string;
}
/** Terminals driven by their own CLI: `open -na <app> --args <args> <sh>
 * <script>` — args come first, the script program is appended. */
 | {
    kind: "openAppArgs";
    app: string;
    args: string[];
}
/** Ghostty: `-e` trips its "Allow Ghostty to Execute" security prompt on
 * EVERY launch (GHSA-q9fg-cpmh-c78x — upstream refuses a disable switch),
 * so the hub drives its AppleScript dictionary instead (Ghostty ≥1.3.0):
 * a `new tab` in the front window reuses an existing window, and `command`
 * on a surface configuration runs the script without the prompt. Only a
 * one-time macOS Automation (TCC) grant for the hub is required. */
 | {
    kind: "ghosttyScript";
    app: string;
}
/** Warp: refuses `.command` files and its CLI is agent-only, but its URI
 * scheme EXECUTES a script handed to action/new_tab's path param
 * (app/src/uri/mod.rs → open_file; verified on 0.2026.09.02): the hub opens
 * `<scheme>://action/new_tab?path=<script>` and Warp runs it as a new tab
 * in its default mode. Preview uses the warppreview:// scheme. */
 | {
    kind: "warpUri";
    app: string;
    scheme: string;
};
/**
 * Pick how to open the TUI script. Preferences arrive pre-merged from
 * `remoteTerminalPrefs` (config file first, env fallback — see config.ts);
 * only the app-name normalization lives here. Priority: the explicit command
 * template (the universal escape hatch) → a built-in launcher by app name
 * (aliases are case- and `.app`-suffix-insensitive) → plain Terminal.app
 * (macOS has no default-terminal setting to detect). Any other unmatched
 * name passes through to `open -a` unchanged.
 */
export declare function resolveTerminalLaunch(env: NodeJS.ProcessEnv, prefs?: TerminalPrefs): {
    launch: TerminalLaunch;
    warning?: string;
};
/**
 * The ORDERED terminal preference list (ADR-0016 amendment): the hub walks
 * it when a window fails — a launch that errors moves down the list at
 * once, a window that never registers moves down at its registration
 * timeout — and only the exhaustion of every entry falls back to headless.
 * Resolution per entry mirrors resolveTerminalLaunch: the explicit command
 * template (the universal escape hatch) replaces the whole list; otherwise
 * a built-in launcher by normalized app name, else `open -a` passthrough.
 * Disabled prefs resolve to [] (no visible-terminal attempts at all).
 */
export declare function resolveTerminalLaunches(prefs: TerminalPrefs): TerminalLaunch[];
/**
 * The .command script body. The incubation env MUST be embedded as exports:
 * the script runs in a fresh shell spawned by the terminal app, which
 * inherits launchd's environment — NOT the hub's — so without them the TUI
 * would boot as a plain local session and never register back (the
 * incubation would stall into its timeout). Everything ZCODE_ACP_* travels,
 * plus the MARTTY_PASSTHROUGH_ENV allowlist; values are single-quoted.
 */
export declare function terminalTuiScript(cwd: string, cliJs: string, env: NodeJS.ProcessEnv): string;
/**
 * The AppleScript source that opens the TUI script as a NEW TAB in Ghostty's
 * front window (a new window only when none exists). See the ghosttyScript
 * launcher: `command` on a surface configuration is Ghostty's trusted,
 * prompt-free path to run a program — unlike `-e`, which trips its
 * "Allow Ghostty to Execute" security gate on every launch.
 */
export declare function ghosttyTabAppleScript(app: string, scriptPath: string): string;
export declare function writeTuiScript(workspace: string, cliJs: string, env: NodeJS.ProcessEnv): string;
/** Reset the quota cache (test helper). */
export declare function resetQuotaCacheForTest(): void;
/** Reset the dock cache (test helper). */
export declare function resetDockCacheForTest(): void;
/**
 * Tab-title sanitizer: the value is printf'd into the terminal as an OSC
 * payload, so control characters (an ESC inside a model-generated summary
 * would inject terminal sequences) become spaces, whitespace collapses, and
 * the length caps at what a tab can usefully show. Empty/non-string →
 * undefined (the caller falls back to the project name).
 */
export declare function sanitizeTabTitle(v: unknown): string | undefined;
/**
 * Start the hub. Resolves once listening; rejects on bind failure (including
 * EADDRINUSE when another hub already owns the port).
 */
export declare function startHub(options: HubOptions & {
    onIdleExit?: () => void;
}): Promise<HubHandle>;
//# sourceMappingURL=hub-server.d.ts.map