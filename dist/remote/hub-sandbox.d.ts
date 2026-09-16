/**
 * Hub sandbox self-relaunch (macOS / launchd).
 *
 * A hub born inside our Seatbelt wrap cannot do its job: `open -a Terminal`
 * for the visible REPL (ADR-0016) gets TCC-attributed to the requester
 * identity "Sandbox" and Terminal silently refuses the document — while
 * `open` itself exits 0, so the incubation just burns its budget and every
 * remote session-create fails. Seatbelt cannot be escaped from within (it
 * is inherited unconditionally across fork/exec), so the only way out is a
 * process that already lives OUTSIDE the sandbox: launchd. The wrapped hub
 * writes a throwaway LaunchAgent plist (launchd reads the path itself, the
 * sandbox does not constrain it) and bootstraps itself into the user's gui
 * domain; the relaunched hub is a clean user process.
 */
/**
 * Set on every sandboxed backend spawn (see server.ts ensureBackend) and
 * inherited down any spawn chain. Its presence in the hub's env means THIS
 * process was born inside the wrap — unlike ZCODE_ACP_SANDBOX, which a user
 * may legitimately set globally and which must NOT trigger a relaunch.
 */
export declare const SANDBOX_ACTIVE_ENV = "ZCODE_ACP_SANDBOX_ACTIVE";
/** launchd label for the self-relaunched hub (machine singleton, like the port). */
export declare const HUB_LAUNCH_LABEL = "com.zcode.acp.hub";
/** Whether this process was born inside our Seatbelt wrap. */
export declare function sandboxBorn(env?: NodeJS.ProcessEnv): boolean;
/**
 * The LaunchAgent plist body: run the hub entry under this node, with THIS
 * process's env minus the birth marker (so the relaunched hub does not
 * re-trigger). RunAtLoad/KeepAlive stay false — the hub is started exactly
 * once, now, via kickstart; if it dies the bridges re-spawn it (the existing
 * machine-singleton behaviour).
 */
export declare function buildHubRelaunchPlist(opts: {
    /** Interpreter argv prefix (e.g. ["bun", "--smol"] or [nodePath]). */
    interpreter: string[];
    hubJs: string;
    env: NodeJS.ProcessEnv;
    logPath: string;
}): string;
/**
 * Relaunch this hub outside the sandbox: write the plist into a fresh
 * mkdtemp (a default-allowed temp tree under the Seatbelt profile, and
 * launchd — outside the sandbox — reads the path itself), load it into the
 * user's gui domain and start the job. Returns true when the relaunch was
 * handed to launchd; false means the caller should keep running (degraded)
 * and warn. Best-effort diagnostics of the relaunched hub land in the log
 * file next to the plist.
 *
 * A label that was already bootstrapped freezes the FIRST plist's definition
 * — `kickstart` restarts whatever is loaded and would silently revive stale
 * env (a rotated token, an old port). The definition must therefore be
 * swapped: bootout the old label, then bootstrap the fresh plist (bootout is
 * asynchronous, so bootstrap retries a few times). A blind kickstart of an
 * unreplaced definition is never attempted.
 */
export declare function selfRelaunchOutsideSandbox(opts: {
    /** Interpreter argv prefix (e.g. ["bun", "--smol"] or [nodePath]). */
    interpreter: string[];
    hubJs: string;
    logPath?: string;
}): boolean;
//# sourceMappingURL=hub-sandbox.d.ts.map