/**
 * Quota dock refresher (ADR-0021) — keeps the Martty TUI's resident quota line
 * up to date.
 *
 * A lazy process-wide singleton: started on first martty session activity, it
 * refreshes every 60s and on every forceRefresh() (wired at turn end). Each
 * successful refresh stores the formatted string on `server.quotaDock` and
 * pushes a `config_option_update` (full options array — martty's subscribe is
 * full-replace semantics) to the martty connections only.
 *
 * Cross-process sharing is hub-first: when the remote hub is reachable, its
 * cached /api/quota/dock endpoint serves the string (~500ms budget); any
 * failure falls back silently to a direct queryQuota() — the fallback is the
 * normal path for local-only users (the hub is opt-in and idle-exits).
 */
import type { ZcodeAcpServer } from "../server.js";
/** Interval between background refreshes. */
export declare const QUOTA_REFRESH_INTERVAL_MS = 60000;
/**
 * Start the refresher (idempotent). No-op unless a martty client has been
 * seen — editor-only setups never poll the quota API in the background.
 */
export declare function startQuotaRefresher(server: ZcodeAcpServer): void;
/** Best-effort immediate refresh (called at every turn end). Never rejects. */
export declare function forceRefreshQuota(): Promise<void>;
/** Stop and forget the singleton (test helper). */
export declare function resetQuotaRefresherForTest(): void;
/** Hub-first dock string, falling back to a direct query. */
export declare function fetchDockText(env?: NodeJS.ProcessEnv): Promise<string | null>;
/**
 * Response-time backstop for the first-fetch race: the first refresh can
 * complete (and emit) BEFORE the boot/resume session is registered in
 * sessionMap — that emit fans out to zero sessions and the sticky
 * `text === prev` short-circuit then suppresses every later identical
 * refresh, so the dock never appears until a turn changes the text. Called
 * setImmediate-style AFTER newSession/resumeSession/loadSession responses,
 * this re-emits the already-fetched value to the now-registered sessions.
 * Full-replace semantics make the duplicate push harmless when the raced
 * emit did land.
 */
export declare function scheduleQuotaDockBackstop(server: ZcodeAcpServer): void;
//# sourceMappingURL=live.d.ts.map