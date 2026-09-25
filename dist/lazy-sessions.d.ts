/**
 * Durable alias store for lazy `session/new` placeholders.
 *
 * `session/new` returns a placeholder id with no backend session behind it
 * (the real `session/create` is deferred to first use). The editor stores this
 * placeholder and may resume it later — including after a bridge restart, when
 * the in-memory `pendingSessions`/`sessionMap` are gone. Without a durable
 * record, `session/resume` then fails with "Session not found".
 *
 * This module keeps a tiny JSON file (`~/.zcode/v2/acp-lazy-sessions.json`,
 * next to tasks-index.sqlite) mapping acp_sid → { cwd, zcodeSid?, createdAt }:
 *   - `rememberLazySession` — written at session/new (no zcodeSid yet);
 *   - `recordMaterializedSession` — updated once the placeholder materializes;
 *   - `lookupLazySession` — lets resume/load/ensureRealSession recover a
 *     placeholder from a previous bridge lifetime.
 *
 * Best-effort side-channel like tasks-index: failures are logged and swallowed
 * so a store problem never breaks session/new or first use. NEVER-USED
 * placeholders older than 30 days are pruned on load — the real session stays
 * reachable via session/list after that, only the unused alias expires.
 * Materialized records never expire: their alias is the only link from the
 * editor's thread id to the backend session.
 */
/** Placeholder alias record persisted in the store. */
export interface LazySessionRecord {
    cwd: string;
    /** Backend session id once the placeholder materialized (absent = never used). */
    zcodeSid?: string;
    createdAt: number;
    /**
     * Last model/thought choice the user set through this bridge (config
     * spelling, e.g. "providerId\modelId"). The backend's own per-session
     * selection entry can be LOST (session_entry has a session FK; setModel
     * before the first prompt hits FOREIGN KEY — source: the row is only
     * created at first input), and a resumed session then silently reverts to
     * the workspace default. Re-applied after every resume (see
     * reassertModelChoice in handlers/session.ts). `at` arbitrates recovery:
     * several aliases can record choices for the SAME backend session
     * (editor + TUI attach), so ensureRealSession re-seeds newer-wins.
     */
    modelChoice?: {
        model?: string;
        thought?: string;
        at?: number;
    };
}
/** Record a new placeholder at session/new (no backend session yet). */
export declare function rememberLazySession(acpSid: string, cwd: string): void;
/** Attach the backend session id once the placeholder materializes. */
export declare function recordMaterializedSession(acpSid: string, zcodeSid: string, cwd: string): void;
/** Merge a model/thought choice patch into an existing record (merge-write). */
export declare function recordModelChoice(acpSid: string, patch: {
    model?: string;
    thought?: string;
    at?: number;
}): void;
/**
 * Freshest model/thought choice recorded for a BACKEND session across every
 * alias. One backend session can hold several acpSids (an editor tab plus a
 * TUI/phone attachment, or an adopted conversation), each recording its own
 * switches — recovering through a STALE alias must not resurrect a choice a
 * fresher alias already replaced. Max-`at` wins; ties keep the first seen.
 */
export declare function lookupModelChoiceByZcodeSid(zcodeSid: string): LazySessionRecord["modelChoice"];
/** Look up a placeholder alias (undefined = unknown to this bridge and store). */
export declare function lookupLazySession(acpSid: string): LazySessionRecord | undefined;
//# sourceMappingURL=lazy-sessions.d.ts.map