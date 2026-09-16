/**
 * ZcodeAcpServer — owns shared server state, the backend client, and registers
 * ACP handlers.
 *
 * This is the long-lived container the entry point wires to the ACP stream.
 * Shared state (session map, pending turns, client capabilities) lives here so
 * every handler layer can reach it without globals.
 */
import type * as acp from "@agentclientprotocol/sdk";
import { ZcodeBackend } from "./backend/index.js";
import { BackgroundTaskListener } from "./handlers/background-tasks.js";
import { SandboxRestartBatcher } from "./handlers/sandbox-allow.js";
import { ClientRegistry } from "./remote/broadcast.js";
/** Client capabilities advertised in the initialize request. */
export interface ClientCapabilities {
    fs?: {
        readTextFile?: boolean;
        writeTextFile?: boolean;
    };
    terminal?: boolean;
    auth?: Record<string, unknown>;
    elicitation?: {
        form?: unknown;
        url?: unknown;
    };
    _meta?: Record<string, unknown>;
}
/** A pending prompt turn. */
export interface PendingTurn {
    zcodeSid: string;
    cancelled: boolean;
    /** Set once session/stop has been fired for this turn, to avoid re-sending. */
    stopSent?: boolean;
    /**
     * Foreground execution id from the backend's `turn.started` payload. The
     * v4/command stop targets it — session/stop alone is ignored by the Aug-28
     * app-server (its abort controller is never registered; see AGENTS.md).
     */
    foregroundExecutionId?: string;
    /**
     * Set when the turn was ended by the stall-recovery heuristic (backend
     * reported idle after a silence) rather than a real turn.completed event.
     * prompt() skips auto-compact for such turns — the completion was inferred,
     * and compressing an in-flight task's context would destroy the work.
     */
    stallRecovered?: boolean;
    /**
     * True when this turn belongs to a goal-loop round (ADR-0022) instead of a
     * client prompt. preemptInFlightTurn must SKIP these turns (park the
     * incoming prompt instead of cancelling) — user text merges at the round
     * boundary. ESC/cancel() still cancels them like any pending turn.
     */
    goalLoop?: boolean;
    /**
     * Set by flushSandboxGrants on a goalLoop turn it is about to cancel for a
     * backend restart: the driver then treats the cancel as "re-dispatch the
     * current ticket on the respawned backend" instead of a user ESC pause.
     */
    sandboxRestart?: boolean;
}
/**
 * How long a "loaded in backend" verification stays trusted. The backend
 * evicts resident runtimes after ~10min idle (observed
 * `session.resident_deactivated`, idleTimeoutMs 600000) and also keeps a
 * small LRU cap, after which every session-scoped RPC fails with
 * "Session is not active" (-32004). Trusting a verification for half the
 * eviction window makes callers redo the resume RPC well before eviction
 * can bite.
 */
export declare const BACKEND_RESIDENT_TTL_MS: number;
export declare class ZcodeAcpServer {
    /** The ZCode subprocess client (lazy — spawned on first use). */
    backend: ZcodeBackend | null;
    /** acp_sid → zcode session id (usually identical, but kept for clarity). */
    readonly sessionMap: Map<string, string>;
    /**
     * Reverse map: zcode session id → acp_sid. The background-task listener only
     * knows the zcode sid (it comes from backend events), but ACP notifications
     * must address the acp_sid the client knows. Usually the two are identical,
     * but forked/loaded sessions can diverge, so we maintain an explicit reverse
     * index rather than assuming equality.
     */
    readonly acpSidByZcodeSid: Map<string, string>;
    /**
     * Sessions returned by `session/new` whose backend session has not been
     * created yet (acp_sid → { cwd }). session/new defers `session/create` until
     * the session is first used, so an editor startup that never prompts leaves
     * no empty session in the backend or the App's task index. `ensureRealSession`
     * materializes these on first use; entries live only as long as the bridge
     * process (a never-used placeholder vanishes with it).
     *
     * `creating` holds the in-flight materialization promise while a first-use
     * create is running, so concurrent first-uses (e.g. a raced double prompt)
     * share one `session/create` instead of creating two backend sessions.
     */
    readonly pendingSessions: Map<string, {
        cwd: string;
        creating?: Promise<string>;
        /** Client-provided MCP servers from session/new, replayed verbatim into
         * the backend's session/create when the lazy session materializes. The
         * backend's mcpServers schema matches the ACP array shape (stdio entries
         * carry command/args/env; remote entries carry type/url), so entries are
         * passed through unchanged. */
        mcpServers?: acp.McpServer[];
    }>;
    /**
     * Session cwds (acp_sid → cwd), recorded at session/new and lazy-recovery.
     * Unlike pendingSessions this survives materialization — the hub discovery
     * payload needs a workspace label for live sessions, whose pending entries
     * are deleted on first use.
     */
    readonly sessionCwds: Map<string, string>;
    /**
     * In-flight `session/resume` single-flight, keyed by backend session id
     * (ADR-0017 first-entry race): the hub answers the App's incubation request
     * as soon as the TUI's bridge REGISTERS — before the TUI's boot-resume
     * finishes — so the App's `session/load` for the SAME backend session can
     * run concurrently and both would send `session/resume`. Concurrent callers
     * instead join the first flight (see resumePreservingModel); the loser's
     * `session/messages` query then lands AFTER hydration, not mid-restore
     * (a mid-restore query returns a prefix and the first-entry replay "ends
     * in the middle").
     */
    readonly resumeInFlight: Map<string, Promise<unknown>>;
    /**
     * Sandbox dynamic-allow state (ADR-0011): realpaths granted for this
     * bridge lifetime ("仅此一次" answers) — folded into the Seatbelt profile
     * on the next backend respawn in ensureBackend().
     */
    readonly sandboxOnceAllows: Set<string>;
    /**
     * Deny paths already asked about, per ACP session — the debounce behind
     * the allow popup (the model retries the same path and must not re-ask).
     * Value is the ask timestamp: Infinity after a user decision or a
     * structural hint; a FAILED ask (timeout / dead channel / killed by
     * another grant's restart) keeps its timestamp and re-asks after the
     * cooldown (see handleSandboxDenial).
     */
    readonly sandboxAskedPaths: Map<string, Map<string, number>>;
    /**
     * EACCES ("Permission denied") paths already hinted, per ACP session — the
     * model routinely probes unreadable directories and each real path gets
     * exactly one hint (see the filesystem-permission scan in session.ts's
     * turn loop; kept separate from sandboxAskedPaths so one flow's debounce
     * never silences the other).
     */
    readonly fsDeniedPaths: Map<string, Set<string>>;
    /**
     * Continuation prompts waiting to run after a sandbox allow restart, per
     * ACP session — set by the batch flush, consumed by prompt() after the
     * interrupted turn unwinds (the new turn tells the model the write is now
     * permitted and to resume the task).
     */
    readonly sandboxContinuations: Map<string, string>;
    /**
     * Batched sandbox allow-restarts (ADR-0011): approvals collect for one
     * window, then flushSandboxGrants() (handlers/sandbox-allow.ts) performs a
     * single cancel-wave + continuation + backend close. One restart per
     * popup used to kill the sibling popups still pending on other denied
     * paths.
     */
    readonly sandboxRestartBatcher: SandboxRestartBatcher;
    /**
     * Whether the current backend subprocess was spawned under sandbox-exec.
     * Process-level fact (not config wish): EPERM in tool output can only come
     * from a sandboxed process, and applySandboxFlip() needs to detect a
     * config-armed sandbox facing an unsandboxed live backend.
     */
    backendSandboxed: boolean;
    /**
     * Currently running turns, keyed by the ACP request id (JSON-RPC ids may be
     * numbers or strings; set/delete always use the same value, so the wider
     * key type is only for honesty).
     */
    readonly pendingTurns: Map<string | number, PendingTurn>;
    /**
     * Per-session (zcodeSid) preempt lock: a promise chain that serializes the
     * "register self + preempt others" critical section in prompt(). Prevents
     * concurrent prompts from both missing each other and registering at once.
     */
    readonly preemptLocks: Map<string, Promise<void>>;
    /** Capabilities advertised by connected clients (Zed, JetBrains, remote). */
    clientCapabilities: ClientCapabilities;
    /**
     * Client name from `initialize` clientInfo ("martty", "Zed", …). Gates
     * client-specific behavior (the TUI resume history replay).
     */
    clientName: string | null;
    /**
     * Sticky: some client named ≈"martty" completed `initialize` this process.
     * `clientName` alone is last-write-wins across the stdio editor and remote
     * WS attaches (a phone app initializing between the TUI's initialize and
     * its session/new would blank it mid-boot), so martty-gated behavior reads
     * this flag instead.
     */
    marttyClientSeen: boolean;
    /**
     * Connection roots (clientConnectionRoot identity) of connections known to
     * be Martty — recorded at THAT connection's `initialize`, never inherited
     * from the process-wide sticky flag (a phone app initializing after the TUI
     * must not become a dock target). The quota dock refresher (ADR-0021)
     * targets exactly these connections with `config_option_update`s, and
     * buildConfigOptions appends the pseudo `quota` option only for them;
     * editors must not see it.
     */
    readonly marttyConnectionRoots: Set<unknown>;
    /**
     * Connection roots of Paseo clients (clientInfo name ≈"paseo"). Paseo already
     * surfaces the ACP session `modes` as its own Mode control and switches via
     * `session/set_mode`, so the redundant category-"mode" config option is
     * omitted for these connections — otherwise Paseo renders it a second time as
     * a setting.
     */
    readonly paseoConnectionRoots: Set<unknown>;
    /**
     * Latest formatted quota dock string (ADR-0021), or null when the last
     * refresh failed / has nothing to show. Maintained by src/quota/live.ts;
     * read by buildConfigOptions when appending the read-only `quota` option.
     */
    quotaDock: string | null;
    /**
     * One-shot banner-handshake scope (see BOOT_RESUME_TRIGGER): the
     * `connectionContext` identity of the client whose boot-resumed session/new
     * armed the trigger. Only THAT connection's first `session/prompt` can
     * spend it — prompts from other attached clients (a phone app racing the
     * boot window) never disarm it. Null once spent or when the auto-submit was
     * lost (the same connection's first prompt was something else).
     */
    bootResumeTriggerConnection: unknown;
    /**
     * Hub session-create binding (remote create, ADR-0016): when the hub
     * incubates a TUI for a remote session-create it pre-generates the ACP
     * session id (ZCODE_ACP_BOOT_CREATE_SESSION + ZCODE_ACP_RESUME_SESSION), so
     * the TUI window at boot AND the attaching phone adopt the SAME session on
     * their first session/new — without it each mints its own placeholder and
     * the phone's conversation never reaches the window (two sessions, updates
     * dropped on the sessionId mismatch). Unlike the one-shot resume env, the
     * bind persists for the bridge's lifetime; each connection claims it once.
     */
    bootCreateBindSession: string | null;
    /** Connection roots that already claimed the create bind (see above). */
    readonly bootCreateBindClaimed: Set<unknown>;
    /**
     * All connected ACP clients (the stdio editor plus any remote WebSocket
     * clients). Handlers push notifications through `clients.broadcast()` so
     * every attached client sees the same stream; the registry replaces the old
     * single `acpClient` reference. Background listeners use it to push
     * `session/update` notifications outside request handlers.
     */
    readonly clients: ClientRegistry;
    /**
     * Lightweight session summaries for the remote hub's discovery API
     * (acp_sid → { title, updatedAt, hasActivity }). In-memory only — the hub
     * holds no business state and the bridge dies with its editor, so
     * persistence would buy nothing. Maintained by `touchSessionSummary` at
     * session registration, title set, and turn completion. `hasActivity` gates
     * the discovery payload: an editor restart auto-resumes its stored
     * placeholder, materializing an empty backend session — never-used sessions
     * stay invisible to remote clients until first real use.
     */
    readonly sessionSummaries: Map<string, {
        title?: string;
        updatedAt: number;
        hasActivity?: boolean;
    }>;
    /** Session titles already set, to enforce set-once (acp_sid → title). */
    readonly sessionTitles: Map<string, string>;
    /**
     * Placeholders minted by a REMOTE-driven session/new (the hub's create-bind
     * or any serve-mode mint). Remote clients have no editor-side session
     * storage, so discovery advertises these in the ACTIVE session list even
     * before the first turn (while they are still pure placeholders). Locally
     * minted ones stay invisible until first use.
     */
    readonly remoteCreatedSessions: Set<string>;
    /**
     * Sessions verified as loaded in the CURRENT backend subprocess, with the
     * verification timestamp — populated only after a successful
     * session/create or session/resume RPC and refreshed when a turn runs. A
     * bare `registerSession` mapping does NOT qualify, and neither does an old
     * timestamp: the backend answers `session/messages` only for sessions with
     * a live resident runtime, so `session/load` must not skip the resume RPC
     * for those (the replay would silently come back empty). Use
     * `markBackendLoaded`/`isBackendSessionLive` instead of touching the map.
     */
    readonly backendLoadedSessions: Map<string, number>;
    /**
     * Sessions eligible for the one-shot auto-title. Only `session/new`
     * populates this — resumed/loaded sessions already carry a title, so their
     * first post-load message must NOT overwrite it. (sessionTitles alone can't
     * distinguish "freshly created" from "resumed but not yet titled in-process".)
     */
    readonly titleEligibleSessions: Set<string>;
    /** Last mode id advertised to the client (acp_sid → modeId), for change detection. */
    readonly lastMode: Map<string, string>;
    /**
     * Timestamp of the last cancel (user stop or preempt), keyed by zcodeSid.
     * Set in cancel() and preemptInFlightTurn(); read in runEventTurn's stall
     * reconciliation to fast-fail turns that collide with the backend's
     * ~20s model-connection recovery window after a mid-stream abort.
     */
    readonly lastCancelledAt: Map<string, number>;
    /** Per-session ProjectionDiffers (persists across turns). */
    readonly differs: Map<string, import("./translators/projection-differ.js").ProjectionDiffer>;
    /** Per-session model cache for configOptions model dropdown. */
    readonly modelCache: Map<string, string>;
    /**
     * Per-session (zcodeSid) background-task listeners. Registered once when a
     * session is created/resumed/loaded and lives across prompts, forwarding
     * background task status + result notifications to the client outside of
     * request handlers. The turn loop's own listener coexists with this one
     * (backend.listeners is now a Set per session).
     */
    readonly backgroundListeners: Map<string, BackgroundTaskListener>;
    /**
     * Per-Bash-callId stdout snapshot already streamed via terminal_output. Used
     * by dispatchTerminalUpdate for two dedup guards:
     *   - progress: diff cumulative stdoutTail snapshots, emit only the suffix.
     *   - result:   if present, the output was already streamed → skip replay.
     * Presence of a key also signals "progress fired for this call" (absent =
     * short command with no progress, so the result emits output once).
     */
    readonly terminalSentData: Map<string, string>;
    /** Monotonic id counter; base 10_000_000 to avoid collisions with zcode-originated ids. */
    private msgCounter;
    /**
     * Headless serve mode (ADR-0014): this bridge was hub-spawned for ONE known
     * project (the process cwd). session/new then ignores client-supplied cwds
     * and always uses the process cwd — the remote create-whitelist stays
     * closed end to end (a client cannot steer a serve bridge into another
     * directory).
     */
    readonly serveMode: boolean;
    constructor(opts?: {
        serveMode?: boolean;
    });
    /** Next JSON-RPC id for messages we send to zcode. */
    nextId(): number;
    /**
     * Lazily spawn the zcode backend on first use (initialize doesn't need it).
     * With the sandbox armed (ZCODE_ACP_SANDBOX=1 globally, or any live
     * workspace's .zcode/acp/sandbox.json — ADR-0011), the spawn is wrapped in
     * a Seatbelt profile built from the live workspace roots — session/new
     * records cwds before any backend RPC (lazy placeholders), so the whitelist
     * is complete by the time the backend materializes here.
     */
    ensureBackend(): ZcodeBackend;
    /**
     * Mark every in-flight turn cancelled — used right before killing the
     * backend WHOLESALE (sandbox arm-flip / allow restart). Those turn loops
     * would otherwise wait on a dead reader with no stall signal (the backend
     * is gone, so no events ever arrive) and hang until the freeze watchdog,
     * ~10 minutes per turn. stopSent: no stop pair is needed — the entire
     * process group dies with the backend.
     */
    cancelAllPendingTurns(skipGoalLoop?: boolean): void;
    /**
     * Workspace roots that parametrize the sandbox decision/profile: every live
     * session's cwd, falling back to the bridge's own cwd before any session.
     */
    sandboxRoots(): Set<string>;
    /**
     * Project-level sandbox flip (ADR-0011): flipping `enabled: true` in a live
     * workspace's .zcode/acp/sandbox.json arms the sandbox mid-run, without a
     * global env. If the flip happened after the current backend spawned
     * unsandboxed, kill it — the caller's next ensureBackend() respawns under
     * the profile, and prompt()'s subscribe recovery reloads the session. The
     * reverse (flipping back to false) never restarts a live sandboxed backend;
     * the next natural respawn drops the wrap. Best-effort: a failed kill
     * leaves things as they were (the sandbox arms on a later respawn).
     */
    applySandboxFlip(): Promise<void>;
    /** Resolve the zcode session id for an ACP session id. */
    resolveSid(acpSid: string): string | undefined;
    /**
     * Register the acp_sid ↔ zcode_sid mapping both ways. Use this instead of
     * `sessionMap.set(...)` directly so the reverse index stays in sync (the
     * background-task listener needs the reverse lookup to address notifications).
     */
    registerSession(acpSid: string, zcodeSid: string): void;
    /** Record that a session is loaded in the current backend subprocess (now). */
    markBackendLoaded(acpSid: string): void;
    /**
     * True when the session was verified backend-loaded recently enough that the
     * backend's resident idle eviction (~10min) can't have dropped it. Stale or
     * unknown entries count as NOT live so callers redo the session/resume RPC.
     */
    isBackendSessionLive(acpSid: string): boolean;
    /** Update a session's discovery summary (title sticky once set). */
    touchSessionSummary(acpSid: string, title?: string): void;
    /**
     * Mark a session as having real interaction (a prompt turn ran, or history
     * was replayed on load). Gates the hub discovery payload — never-used
     * sessions stay invisible to remote clients until first use.
     */
    markSessionActive(acpSid: string): void;
    /**
     * The bridge's project directory: the cwd of the most recently active
     * session, else the bridge process cwd (Zed spawns the server with the
     * worktree root as cwd). Recent-activity wins over Map order — insertion
     * order is arbitrary across load/resume timing, and a single polluted
     * entry ("/") must never decide the label for every session. Roots of "/"
     * are skipped entirely: they can only come from a client fallback, never a
     * real worktree.
     */
    projectCwd(): string;
    /** Best-effort workspace label for the hub discovery payload. */
    workspaceLabel(): string;
    /**
     * Live goal-loop drivers by backend session id (ADR-0022). Membership = a
     * loop is RUNNING for that session (terminal drivers deregister in the
     * run() finally). The prompt path consults this to park user prompts on
     * the driver instead of preempting its turns.
     */
    readonly goalLoops: Map<string, import("./goal-loop/driver.js").GoalLoopDriver>;
    /**
     * zcodeSids that already got the goal-loop recovery hint on session/load
     * this bridge process (each editor (re)attach would otherwise replay it).
     */
    readonly goalLoopLoadHints: Set<string>;
    /**
     * Ensure a background-task listener is registered for the session. Idempotent
     * — returns the existing listener if already registered (covers resume/load
     * after new, and fork). Lives for the whole session so background agents that
     * finish AFTER `session/prompt` returns still get their status/result
     * forwarded to the client. The turn loop's own listener coexists via the
     * backend's per-session listener Set.
     */
    ensureBackgroundListener(zcodeSid: string): BackgroundTaskListener;
    /** Resolve the ACP session id for a zcode session id (reverse of resolveSid). */
    resolveAcpSid(zcodeSid: string): string | undefined;
    /**
     * Every ACP alias attached to the same backend conversation — at least
     * [acpSid] itself. Two clients can hold DIFFERENT acpSids for one
     * conversation (a fresh session/new placeholder in one, a session/list id
     * resumed in another), and clients route session-scoped notifications by
     * the payload sessionId. Anything emitted under the prompting client's id
     * alone is silently dropped by every client holding another alias, so
     * session-scoped emits (updates, turnState, prompt echo) must loop this
     * list. A client holding two aliases of one conversation gets both copies —
     * pathological, accepted.
     */
    sessionAliases(acpSid: string): string[];
    /**
     * Push a `session/update` notification to the client from OUTSIDE a request
     * handler (used by the background-task listener). Resolves the acp_sid from
     * the zcode_sid and no-ops (returning false) if the client or session is
     * unknown. Never throws — callers run in the event loop and must not crash
     * the bridge on a notification failure.
     */
    notifyByZcodeSid(zcodeSid: string, update: acp.SessionUpdate): Promise<boolean>;
    /** Whether the client declared `_meta.terminal_output` (Zed's Bash UI hook). */
    supportsTerminalOutput(): boolean;
    /**
     * Whether the client supports form-based elicitation (`clientCapabilities.
     * elicitation.form`). When true, AskUserQuestion / ExitPlanMode can use the
     * richer `elicitation/create` form UI; otherwise they fall back to
     * `session/request_permission`.
     */
    supportsElicitationForm(): boolean;
    /**
     * Whether a martty TUI is (or was) attached to this bridge process. Same
     * semantics as session.ts's isMarttyClient: the sticky flag wins because
     * clientName is last-write-wins across multi-client attaches. Used to gate
     * surfaces where martty's rendering is the limiting factor — its
     * request_permission overlay draws only the title, so plan approval needs
     * the elicitation form there; editors render toolCall.content and must NOT
     * be pushed to the form (its descriptions are plain text in Zed).
     */
    hasMarttyClient(): boolean;
    /**
     * Whether the ACP client is Paseo. Paseo surfaces the session `modes` as its
     * own Mode control and switches via `session/set_mode`, so the bridge omits
     * the redundant category-"mode" config option for it. Checked process-wide,
     * not per connection: paseo spawns a dedicated bridge process per session and
     * `clientConnectionRoot` can be undefined on later requests.
     */
    isPaseoClient(): boolean;
    /**
     * OR-merge capabilities from a newly connected client. Each connection runs
     * its own `initialize`; boolean capabilities are unioned across clients so a
     * feature advertised by ANY attached client (Zed or a remote one) enables the
     * richer interaction path, and `_meta` flags (e.g. terminal_output) merge
     * shallowly. Idempotent for re-connecting clients with equal capabilities.
     */
    mergeClientCapabilities(caps: ClientCapabilities): void;
    /** Handle `initialize`: negotiate version + declare agent capabilities.
     *  `client` is the calling connection's AgentContext — martty identity is
     *  recorded PER CONNECTION here, so later non-martty attaches never inherit
     *  quota-dock targeting from the sticky process flag. */
    initialize(params: acp.InitializeRequest, client?: acp.AgentContext): Promise<acp.InitializeResponse>;
}
//# sourceMappingURL=server.d.ts.map