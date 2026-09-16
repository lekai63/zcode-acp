/**
 * Event-stream listener and turn monitor.
 *
 * `EventStreamListener` subscribes to ZCode's `session/subscribe` event push
 * (deliveryKind `desktop-continuous`) and queues `session/event` notifications
 * for the turn loop to consume. It tracks a `lastSeq` watermark and can
 * resubscribe from it to recover missed events after a stall.
 *
 * `TurnMonitor` is the legacy snapshot path: a one-shot `session/read` that
 * returns the latest projection. Used for stall reconciliation, but never as
 * proof of protocol progress because a `running` projection may be stale.
 */
import type { ZcodeBackend } from "./client.js";
import type { ZcodeEvent, ZcodeProjection, ZcodeSnapshot } from "./types.js";
/** ID generator function (the server's `_next_id`). */
export type NextId = () => number;
export declare class EventStreamListener {
    private readonly backend;
    readonly sid: string;
    /** High-watermark of consumed event sequence numbers. */
    lastSeq: number;
    subscribed: boolean;
    private readonly queue;
    private readonly waiters;
    constructor(backend: ZcodeBackend, zcodeSid: string);
    /**
     * Subscribe and capture the initial snapshot + eventSeq watermark.
     *
     * Returns the snapshot (with projection/messages). Throws on failure,
     * surfacing the backend's real error message (reader dead, timeout, pipe
     * broken, method not found on old CLI, or a session-level business error) so
     * the caller can distinguish root causes instead of seeing a single
     * misleading "version too old" string.
     */
    subscribe(nextId: NextId): Promise<ZcodeSnapshot>;
    /** Called by the backend reader when a `session/event` arrives. */
    handleEvent(event: ZcodeEvent): void;
    /**
     * True if events are queued waiting for a poll (non-destructive). Lets the
     * turn loop check liveness without consuming an event — used by the stall
     * reconciliation to confirm a turn is still alive before ending it.
     */
    hasQueuedEvents(): boolean;
    /**
     * Wait for the next event, resolving once one arrives or `timeoutMs` elapses
     * (resolves null on timeout). Events arriving with no active waiter are
     * queued. A timed-out waiter is marked `done` so a later event skips it
     * instead of being silently dropped on a settled promise.
     */
    pollEvent(timeoutMs?: number): Promise<ZcodeEvent | null>;
    /**
     * Stall recovery: resubscribe from `lastSeq` so the server replays missed
     * events. Failure is logged but non-fatal — the caller degrades to polling.
     * The snapshot (if returned despite `includeSnapshot:false`) is intentionally
     * not consumed; resubscribe only refreshes the watermark + resumes the push.
     */
    resubscribe(nextId: NextId): Promise<boolean>;
}
/**
 * Legacy snapshot path: a single `session/read` returning the latest
 * projection. Used in stall reconciliation; prompt-lock state is probed
 * separately because a `running` projection may be stale.
 */
export declare class TurnMonitor {
    private readonly backend;
    private readonly zcodeSid;
    private readonly nextId;
    constructor(backend: ZcodeBackend, zcodeSid: string, nextId: NextId);
    /** Returns the projection snapshot, or null on error. */
    pollOnce(): Promise<ZcodeProjection | null>;
}
//# sourceMappingURL=listener.d.ts.map