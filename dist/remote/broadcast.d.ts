/**
 * Multi-client broadcast layer for remote access.
 *
 * The bridge historically served ONE ACP client (the editor over stdio). With
 * remote access enabled, additional clients attach over WebSocket; every
 * agent-originated message must reach all of them. This module owns the client
 * registry and a stable proxy that quacks like an `AgentContext`:
 *
 * - `notify` fans out to every client; a single dead/slow client is warned
 *   about and never fails the others.
 * - `request` (permission / elicitation) is sent to every client and the FIRST
 *   response wins. Losers are aborted via `cancellationSignal`, which makes
 *   the SDK emit `$/cancel_request` so the losing editor dismisses its dialog
 *   (verified against Zed's ACP client).
 *
 * Loser promises settle late (the peer answers the cancellation eventually) —
 * every raced promise carries a no-op catch so late settlements can't surface
 * as unhandledRejection (Node ≥15 crashes on those by default).
 */
import type * as acp from "@agentclientprotocol/sdk";
/** The AgentContext surface the bridge actually calls. */
export interface ClientLike {
    notify(method: string, params?: unknown): Promise<void>;
    request(method: string, params?: unknown, options?: acp.SendRequestOptions): Promise<unknown>;
}
/**
 * Track every connection opened on the app (stdio editor + remote WebSocket)
 * in the registry, removing each on close. Wired once by the entry point
 * BEFORE `connect()` so the stdio connection is captured too.
 */
export declare function trackConnections(app: acp.AgentApp, clients: ClientRegistry): void;
/**
 * Registry of connected ACP clients (stdio editor + remote WebSocket clients).
 * Membership is managed by the entry point via the SDK's per-connection
 * lifecycle; the broadcast proxy reads membership live on every call.
 */
export declare class ClientRegistry {
    private readonly clients;
    private proxy;
    /** clientInfo name per connection root (see `nameConnection`). */
    private readonly names;
    add(cx: ClientLike): void;
    remove(cx: ClientLike): void;
    get size(): number;
    /**
     * Record a connection's `initialize` clientInfo name, keyed by the SDK's
     * per-connection root (same identity `notifyOthers` filters on) so payloads
     * can be tailored per client (`notifyEach`). Unnamed clients (the remote
     * App sends no clientInfo) read as null — distinct from "" only in that an
     * initialize was never seen for the connection.
     */
    nameConnection(cx: ClientLike, name: string): void;
    /** Name recorded at initialize for this connection, null when none. */
    nameOf(cx: ClientLike): string | null;
    /**
     * Fan out a notification whose payload is built PER CLIENT from its recorded
     * name (null payload = skip that client). Used for `available_commands_update`:
     * editors keep the `$` skill grouping, martty and unnamed clients get the
     * bare names so their `/` completion menu shows skills at all.
     */
    notifyEach(method: string, build: (name: string | null) => Record<string, unknown> | null): Promise<void>;
    /** Stable broadcast proxy satisfying the `AgentContext` call surface. */
    broadcast(): acp.AgentContext;
    /**
     * Notify every client EXCEPT the one whose connection issued the current
     * request (`exclude` is that connection's AgentContext — `ctx.client` from a
     * handler). Identity is by the shared per-connection context: each request
     * wraps it in a fresh AgentContext, so the wrappers never compare equal.
     * (`connectionContext` is the SDK's per-connection root — public at runtime,
     * @internal in the typings, hence the cast.) Used for the user-prompt echo:
     * the prompting client renders its own outgoing message locally and would
     * duplicate an echo.
     */
    notifyOthers(exclude: acp.AgentContext, method: string, params?: unknown): Promise<void>;
    snapshot(): ClientLike[];
}
//# sourceMappingURL=broadcast.d.ts.map