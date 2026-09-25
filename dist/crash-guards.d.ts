/**
 * Process-level crash guards + a diagnostic on-disk log for the bridge.
 *
 * The bridge is a LONG-LIVED process hosted inside an editor extension host,
 * a martty TUI, or a hub incubation — when it dies, the whole window dies
 * with it and its stderr vanishes with the terminal (observed 2026-09-23: a
 * bun-hosted bridge died ~25ms after issuing session/create in a fresh
 * workspace; the backend saw its stdin close, shut down, and martty exited —
 * and NOTHING remained to say why the bridge died). Two layers fix both
 * halves:
 *
 * 1. `unhandledRejection` / `uncaughtException` handlers that WARN instead of
 *    dying. Node ≥15 and Bun both crash the process on an unhandled rejection
 *    by default; the codebase's convention is already "best-effort in event
 *    handlers, failures are logged, never thrown into the event loop", but a
 *    single missed `.catch` anywhere still took the window down. Swallowing
 *    is the right trade for a stateless-per-request bridge: a dropped
 *    notification beats a dead session.
 * 2. A daily diary at `~/.zcode/cli/log/zcode-acp-YYYY-MM-DD.log` (next to
 *    the backend's own logs) that every `warn()` appends to. The diary is
 *    what survives the window: the next crash leaves its reason on disk.
 *
 * EPIPE on stdout is the one deliberate exit: the ACP client is gone, so the
 * process is an orphan holding a hub registration — record and exit cleanly.
 */
/**
 * Append one line to the daily diary. Best-effort by design: a read-only or
 * unwritable HOME must never turn a warning into a crash (the append runs
 * inside warn() on hot paths). First use creates the directory.
 */
export declare function appendDiary(line: string): void;
/** Extract a printable reason (message + stack head) from anything thrown. */
export declare function describeError(reason: unknown): string;
/** Is this the "ACP client is gone" pipe break that should end the process? */
export declare function isStdoutPipeBreak(reason: unknown): boolean;
/**
 * Install the process-wide guards. Idempotent. Call at the top of every
 * long-lived entry point (the stdio bridge, the serve bridge, the hub) BEFORE
 * any I/O — a rejection racing the install would still kill the process.
 */
export declare function installCrashGuards(): void;
/** Test seam: allow re-installing into a fresh listener set. */
export declare function resetCrashGuardsForTest(): void;
//# sourceMappingURL=crash-guards.d.ts.map