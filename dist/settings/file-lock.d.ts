/**
 * Cross-process file lock — the same protocol the ZCode desktop app uses.
 *
 * The settings API writes config files the desktop app also writes. An atomic
 * rename makes each individual write safe, but it does NOT make two writers
 * mutually exclusive: a settings write that lands while the app is writing the
 * same file silently discards the app's change. Sharing the app's lock is the
 * only way to avoid that, so this module re-implements its protocol exactly
 * (ADR-0026):
 *
 *   - lock directory `<path>.lock`, created with `mkdir` (atomic on POSIX)
 *   - one `owner-<pid>-<ts>-<rand>.json` per holder, written `wx`
 *   - a holder is authoritative only while its own owner file is the sole
 *     entry and the directory identity (dev+ino) has not changed
 *   - stale reclaim: owner pid no longer alive, or an ownerless lock past the
 *     grace window. Never steal from a live holder.
 *
 * Timestamps in owner files are validated against a clock-skew ceiling so a
 * malformed or future-dated `createdAt` cannot keep a lock permanently
 * unreclaimable.
 *
 * Everything is best-effort in the caller's favour: reaching the wait cap
 * throws a lock-timeout error rather than deleting a newer writer's lock.
 */
export interface FileLockOptions {
    lockRetryDelaysMs?: readonly number[];
    lockOwnerlessGraceMs?: number;
    lockMaxWaitMs?: number;
}
/** Error code for a lock that could not be acquired within the wait cap. */
export declare const FILE_LOCK_TIMEOUT_ERROR_CODE = "ZCODE_FILE_LOCK_TIMEOUT";
/**
 * Run `operation` while holding ZCode's lock for `filePath`.
 *
 * @throws with code {@link FILE_LOCK_TIMEOUT_ERROR_CODE} when the lock could
 *         not be acquired within `lockMaxWaitMs`.
 */
export declare function withFileLock<T>(filePath: string, operation: () => Promise<T>, options?: FileLockOptions): Promise<T>;
//# sourceMappingURL=file-lock.d.ts.map