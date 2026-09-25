/**
 * Bridge-emitted user-facing strings (editor popups, status/hint lines).
 *
 * Language selection, first match wins:
 *   1. Explicit override — `lang` in ~/.config/zcode-acp/config.json, else
 *      ZCODE_ACP_LANG ("zh", "en"; prefixes like "zh_CN" accepted,
 *      case-insensitive)
 *   2. The ZCode desktop app's language choice — `localePreference` (explicit
 *      user pick), falling back to `locale` (effective), in
 *      <zcode-home>/v2/setting.json (the ZCode data root — `~/.zcode`, or
 *      `$ZCODE_HOME` when set); absent when the app was never installed
 *   3. LC_ALL / LC_MESSAGES / LANG — POSIX locale sniff ("zh*" → zh)
 *   4. English (the project ships bilingual READMEs; international default)
 *
 * `log()`/`warn()` diagnostics stay English — they are developer-facing.
 * Resolved per call (not at import) so tests can stub the env per case; the
 * app-settings read is memoized per process (it would otherwise hit the disk
 * on every emitted message).
 */
export type Lang = "en" | "zh";
export declare function resolveLanguage(env?: NodeJS.ProcessEnv): Lang;
export interface Messages {
    /** Sandbox permission popup — the four ACP option names. */
    sandboxOptionAllowAlways: string;
    sandboxOptionAllowOnce: string;
    sandboxOptionRejectOnce: string;
    sandboxOptionRejectAlways: string;
    sandboxPopupTitle: (path: string) => string;
    sandboxPopupDetails: (path: string) => string;
    /** Island/strictGit denies can never be overridden by an allow. */
    sandboxProtectedHint: string;
    /** A grant for $HOME (or an ancestor) would gut the sandbox. */
    sandboxOverBroadHint: (path: string) => string;
    /** Path already in the config's deny list (earlier "always reject"). */
    sandboxDenyListedHint: (path: string) => string;
    sandboxRejectAlwaysPersisted: (path: string) => string;
    sandboxRejectAlwaysUnpersisted: (path: string) => string;
    sandboxRejectOnceHint: (path: string) => string;
    /** Continuation prompt sent to the model after an allow restart (all
     *  paths granted in one restart batch are listed together). */
    sandboxContinuationPrompt: (paths: string[]) => string;
    /** The chained continuation round itself failed (backend warm-up window). */
    sandboxContinuationFailed: (err: string) => string;
    sandboxRestartHint: (path: string) => string;
    sandboxResumedStatus: string;
    /** EPERM seen in tool output but no path could be extracted. */
    sandboxGenericDenialHint: string;
    /** Ordinary filesystem-permission failure (EACCES) in tool output — not a
     *  sandbox block, and nothing a popup could allow; one hint per path. */
    fsPermDeniedHint: (path: string) => string;
    networkRetry: (attempt: number, total: number) => string;
    requestFailed: (err: string) => string;
    /** Backend process lost mid-turn; recovered by respawn + session reload. */
    backendRecovered: (attempt: number, total: number) => string;
    /** Goal-loop level: the round failed on a lost backend but is being retried. */
    goalBackendRecovered: string;
    /** Prompt queued behind a still-generating turn (drain gate). */
    promptQueuedBehindTurn: string;
    /** Live sub-agent roster line during silent phases (session/subagents). */
    subagentStatusLine: (running: number, waiting: number, blocked: number) => string;
    /** One-shot terminal summary for sub-agents that ended during the turn. */
    subagentEndedLine: (ended: number, failed: number, cancelled: number) => string;
    thinkingPlaceholder: string;
    /** Steered prompt silently swallowed by the still-running turn. */
    messageSwallowedByTurn: string;
    interactionInterrupted: string;
    /** ExitPlanMode permission popup. */
    planApproveOption: string;
    planRejectOption: string;
    planPopupTitle: string;
    /** ExitPlanMode elicitation form (form-capable clients): field label. */
    planFieldTitle: string;
    /** AskUserQuestion: skip choices in both popup and elicitation forms. */
    askSkipOption: string;
    askSkipQuestionTitle: string;
    askIncludeOption: (label: string) => string;
    askSkipLabelOption: (label: string) => string;
    /** tool_call title for an AskUserQuestion turn in the transcript. */
    askQuestionsTitle: string;
    /** Slash-command feedback lines rendered into the chat. */
    slashCompacted: string;
    /** Ack for the boot-resume banner handshake (auto-submitted trigger). */
    bootResumeAck: string;
    slashCompactTimeout: string;
    slashCompactFailed: string;
    slashCompactAlreadyRunning: string;
    slashGoalSet: (value: string) => string;
    slashAutoSet: (value: string) => string;
    slashErrAutoArg: string;
    /** Goal loop (ADR-0022) feedback lines. */
    goalStarted: (objective: string) => string;
    goalResumed: (rounds: number) => string;
    goalStatus: (status: string, rounds: number, maxRounds: number, done: number, total: number, currentTitle?: string) => string;
    goalPaused: (reason: string) => string;
    goalStopped: string;
    goalComplete: (rounds: number) => string;
    goalImpossible: (why: string) => string;
    goalVerifyFailed: (title: string, reason: string) => string;
    goalVerifyUnparsed: string;
    goalVerifyUnreadable: (title: string) => string;
    goalStallPaused: string;
    goalReport: (rounds: number, maxRounds: number, ticketTitle: string, done: boolean) => string;
    /** Goal-loop recovery hints on session/load (ADR-0022 §6). */
    goalHintInterrupted: (objective: string) => string;
    goalHintPaused: string;
    slashForked: (sessionId: string) => string;
    slashModelSet: (value: string) => string;
    slashTuiOnly: (cmd: string) => string;
    /** /resume (adopt a past session into this editor thread). */
    slashResumePickTitle: string;
    slashResumeNone: string;
    slashResumeCancelled: string;
    slashResumeBusy: string;
    slashResumeNotEmpty: string;
    slashResumeFailed: string;
    slashResumed: (title: string) => string;
    slashErrResumeArg: (arg: string) => string;
    /** Placeholder alias lost/expired — the thread id is unresolvable. */
    loadUnknownAlias: (sid: string) => string;
    /** Alias resolves but the backend session itself was deleted/evicted. */
    sessionEvicted: (sid: string) => string;
    /** Collapsed tool-call titles during session/load replay. */
    replayCompactSummary: string;
    replayContextHandoff: string;
    replayToolFallback: (tool: string) => string;
    /** Changed-files card emitted as a tool_call update during a live turn. */
    changedFilesTitle: (count: number, preview: string) => string;
    affectedFilesList: (files: string[]) => string;
    /** `/mcp` server-listing card. */
    mcpNone: string;
    mcpHeader: (count: number) => string;
    mcpFromConfig: string;
    mcpFromPlugins: string;
    mcpFooter: string;
    /** `/mcp` live health panel (backend mcp/list mode:"status"). */
    mcpHealthHeader: (count: number) => string;
    mcpHealthTools: (count: number) => string;
    /** Turn-end status line (`turn.completed` resultType + cacheStats). */
    turnCompleted: string;
    turnCompletedCache: (cached: number, total: number, cacheRead?: string) => string;
    turnStoppedEarly: (resultType: string) => string;
    /** Editor slash-command menu: localized descriptions for the static
     *  commands (names and argument hints stay as-is — they are tokens). */
    slashCommandDescriptions: Record<string, string>;
    /** /workflow · /workflows with the dynamic-workflow gate disabled/pending. */
    workflowDisabled: string;
    /** Auto-compaction status lines. */
    autoCompactStart: (used: string, threshold: string) => string;
    autoCompactTimeout: string;
    autoCompactDone: string;
    autoCompactFailed: (err: string) => string;
    /** Fixed reason text for a backend-reported compaction failure (state.updated
     *  session_compact_failed/cancelled) — fed into autoCompactFailed. */
    autoCompactBackendFailed: string;
    /** Prompt rejection notice: a detached auto-compact is running, the message
     *  was NOT sent — resend after the ✓ compressed line. Now only the bounded
     *  fallback (a compaction that outlived its settle cap) answers this. */
    autoCompactBusy: string;
    /** Prompt hold notice: a detached auto-compact is running, the message is
     *  QUEUED and goes out by itself once the compaction settles — the session
     *  stays "executing" and the user has nothing to resend. */
    autoCompactHeld: string;
    /** Goal-loop wait note: a compaction holds the lock, the round resumes by
     * itself once it settles (no user action needed). */
    autoCompactGoalWait: string;
    /** Pre-popup tool_call titles for interactive requests. */
    popupTitleExitPlan: string;
    popupTitleToolPermission: (tool: string) => string;
    popupTitleInteraction: string;
    /** Replay fallback title when a history tool has no name/title. */
    replayToolCallFallback: string;
    /** Background-task card title (empty description → fallback). */
    backgroundTaskTitle: (description: string) => string;
    /** Slash-command errors surfaced to the editor via RequestError. */
    slashErrGoalArg: string;
    slashErrModelArg: string;
    slashErrSwitchFailed: (model: string) => string;
    slashErrArg: (cmd: string) => string;
    slashErrUnknown: (cmd: string) => string;
    slashErrFailed: (cmd: string, msg: string) => string;
}
/** Current message table — resolved per call so env changes/tests apply live. */
export declare function messages(): Messages;
//# sourceMappingURL=i18n.d.ts.map