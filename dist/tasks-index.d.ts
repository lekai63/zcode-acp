/**
 * ZCode App tasks-index sync: let the App UI see ACP-created sessions.
 *
 * The ZCode App's session list reads from `~/.zcode/v2/tasks-index.sqlite`
 * (the `tasks` table), NOT from the CLI's `~/.zcode/cli/db/db.sqlite`. These
 * are independent stores — the App's Electron host maintains tasks-index; the
 * headless app-server (which we drive) writes only to cli/db. As a result,
 * every session created via ACP is invisible in the App's UI until the App
 * happens to reindex.
 *
 * This module bridges that gap by writing a tasks-index row directly after
 * session/create. The App picks it up on its next list refresh. INSERT OR
 * IGNORE avoids clobbering rows the App already manages.
 *
 * Best-effort side-channel: failures (locked DB, schema drift) are logged and
 * swallowed so they never break the session/create path.
 */
/**
 * Insert (or refresh) a row in tasks-index.sqlite so the App UI shows it.
 * Called after a successful session/create. Uses INSERT OR IGNORE so it never
 * overwrites a row the App is actively managing (e.g. user-renamed titles).
 *
 * Returns true if written, false on failure (logged, never thrown).
 */
export declare function upsertSessionTask(opts: {
    workspaceKey: string;
    taskId: string;
    title: string;
    traceId?: string;
    model?: string;
    status?: string;
}): Promise<boolean>;
/**
 * User-driven rename (remote rename endpoint): pins the title with
 * title_overridden=1 — the same marker the App's own rename flow sets — so no
 * later automatic write can touch it. Best-effort: returns false when the row
 * is missing or the index is unavailable.
 */
export declare function renameSessionTask(taskId: string, title: string): Promise<boolean>;
/**
 * Update a session's title + searchable_text after the first turn.
 *
 * session/create leaves title empty; once the first prompt completes, set a
 * meaningful title. Respects title_overridden: if the user already renamed in
 * the App, their title wins (but searchable_text is still refreshed — it's not
 * user-controlled).
 *
 * `searchableText` feeds the App's full-text search (the App builds it via
 * `buildSearchableTextFromMessages`: each message's content trimmed + joined
 * by newlines, capped at 200k chars). We pass the first user prompt here; the
 * App later overwrites it with the full conversation when it reindexes, but
 * having it non-empty from the start means the row shows up in search and
 * matches the shape of App-created rows.
 */
export declare function updateSessionTitle(taskId: string, title: string, searchableText?: string): Promise<boolean>;
/** One known project workspace, as recorded by the App's tasks index. */
export interface KnownWorkspace {
    workspacePath: string;
    sessions: number;
    lastActive: number;
}
/**
 * Whether a recorded workspace path may be offered for remote session
 * creation. Excludes: degenerate roots, system temp trees (macOS /tmp is a
 * symlink to /private/tmp — both spellings; $TMPDIR lives under /var/folders),
 * and the ZCode data root itself (the config home, not a project). The
 * directory must still exist — a moved/deleted project disappears from the
 * list.
 */
export declare function isSelectableWorkspace(p: string): boolean;
/**
 * Every project workspace the tasks index has ever recorded a session for —
 * the machine's known-projects list. Serves the hub's remote session-create
 * API: the list gates which projects POST /api/instances accepts. A
 * convenience bound, not a security boundary — bridge-side session
 * materialization writes rows too, and a token holder can drive an
 * editor-bridge session in any cwd (the real boundary is the token).
 *
 * Read-only and best-effort: node:sqlite unavailable → empty list; lock
 * contention retries via withSqliteRetry; other failures warn and return
 * empty. `dbPath` defaults to the App's index (tests inject a fixture).
 */
export declare function listKnownWorkspaces(dbPath?: string): Promise<KnownWorkspace[]>;
//# sourceMappingURL=tasks-index.d.ts.map