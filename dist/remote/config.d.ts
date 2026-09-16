/**
 * Remote access configuration: user config file first, env fallback.
 *
 * Remote access is opt-in and REQUIRES a token — the endpoint is expected to
 * sit behind a public tunnel (Cloudflare Tunnel, frp), so "loopback-only" is
 * never a safe assumption here. A missing token disables the feature with a
 * warning instead of failing the bridge: the stdio link to the editor must
 * keep working no matter what.
 *
 * Sources, in priority order (per field):
 *   1. ~/.config/zcode-acp/config.json `remote` section (XDG_CONFIG_HOME
 *      aware) — the authoritative, launch-context-independent source. The
 *      hub daemon is idle-exited and re-spawned by arbitrary bridges, so its
 *      birth env rotates; user preference must not.
 *   2. Environment variables (unchanged semantics — setups without a file
 *      keep working, and env fills any field the file leaves unset):
 *     ZCODE_ACP_REMOTE=1            enable the remote endpoint (gate)
 *     ZCODE_ACP_REMOTE_TOKEN=<s>    auth token (mandatory when enabled)
 *     ZCODE_ACP_HUB_PORT=8377       hub's fixed port (the one a tunnel maps)
 *     ZCODE_ACP_HUB_HOST=127.0.0.1  hub bind address (e.g. 0.0.0.0 for a
 *                                   containerized tunnel agent)
 *     ZCODE_ACP_REMOTE_PORT=8378    bridge endpoint start port (auto-increment
 *                                   when taken; loopback only)
 *     ZCODE_ACP_HUB_TERMINAL=0      disable the visible-terminal incubation
 *     ZCODE_ACP_HUB_TERMINAL_APP=<name>   terminal app for the TUI window
 *     ZCODE_ACP_HUB_TERMINAL_APPS=<a,b,…>  ordered terminal fallback list
 *                                   (file `remote.terminal.terminals` wins;
 *                                   tried in order before going headless)
 *     ZCODE_ACP_HUB_TERMINAL_COMMAND=<sh> shell command template ({script})
 *   3. Built-in defaults.
 *
 * Process-role plumbing stays env-only by design (never file-configurable):
 *   ZCODE_ACP_REMOTE_ORIGIN=serve  registration origin override (ADR-0016)
 *   ZCODE_ACP_REMOTE_PIN_CWD=1     pin session roots to the process cwd
 *   ZCODE_ACP_RESUME_SESSION=<id>  per-request boot-resume target (ADR-0017)
 */
import { type TerminalPrefs } from "../config/user-config.js";
export interface RemoteConfig {
    token: string;
    hubPort: number;
    hubHost: string;
    bridgePort: number;
    /**
     * Who this bridge serves: "editor" (spawned by an editor over stdio) or
     * "serve" (headless, hub-spawned for remote session-create, ADR-0014).
     * Rides the registration heartbeat; the hub uses it to dedupe headless
     * instances per workspace and label them for remote clients.
     */
    origin: "editor" | "serve";
    /**
     * Pin every session root to the process cwd (serveMode for the bridge).
     * Set by the hub when it incubates a REPL in a visible terminal
     * (ADR-0016): the REPL bridge is a stdio bridge by lifecycle, but its
     * sessions must obey ADR-0014's whitelist semantics — a remote client
     * must not steer them into arbitrary directories.
     */
    pinCwd: boolean;
}
export declare const DEFAULT_HUB_PORT = 8377;
export declare const DEFAULT_BRIDGE_PORT = 8378;
export declare const DEFAULT_HUB_HOST = "127.0.0.1";
/** Parse remote config; null = disabled (or misconfigured → warned). */
export declare function parseRemoteConfig(env?: NodeJS.ProcessEnv): RemoteConfig | null;
/**
 * Live "is remote still enabled?" re-check for the hub's idle decision: same
 * precedence as birth (file wins, env decides when the file is silent) but
 * WITHOUT token validation or warnings — the hub only uses it to decide
 * whether to retire or keep listening for phone-driven create/resume.
 */
export declare function remoteEnabledLive(env?: NodeJS.ProcessEnv): boolean;
/** Parse hub-side config for the standalone hub entry (`zcode-acp hub`). */
export declare function parseHubConfig(env?: NodeJS.ProcessEnv): RemoteConfig | null;
/**
 * Terminal incubation preferences for the hub (ADR-0016), merged file > env.
 * Read LIVE by the hub at every incubation so editing the file takes effect
 * without a hub restart — the hub outlives the shells that configured it.
 */
export declare function remoteTerminalPrefs(env?: NodeJS.ProcessEnv): TerminalPrefs;
//# sourceMappingURL=config.d.ts.map