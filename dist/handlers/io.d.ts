/**
 * ACP client I/O helpers — thin wrappers over the AgentContext (cx) that the
 * ACP SDK passes to each handler.
 *
 * The SDK exposes `cx.notify(method, params)` and `cx.request(method, params)`;
 * these helpers name the common notifications/requests we send and centralise
 * the JSON shape so handlers stay readable.
 */
import type * as acp from "@agentclientprotocol/sdk";
import type { ClientRegistry } from "../remote/broadcast.js";
import type { ZcodeAcpServer } from "../server.js";
/**
 * Send a `session/update` notification to the client, serialized through the
 * per-session replay guard (see `enqueueSessionSend`).
 */
export declare function sendSessionUpdate(cx: acp.AgentContext, sessionId: string, update: acp.SessionUpdate): Promise<void>;
/**
 * Run one client-notification send through the per-session replay guard:
 * while a replay batch (`withReplayBatch`) is in flight for this session, the
 * send queues behind it so a batch is never interleaved with live updates —
 * this applies to background-task emissions too, not just handler dispatch.
 * Sessions that never replay take the lock-free fast path.
 */
export declare function enqueueSessionSend(sessionId: string, send: () => Promise<void>): Promise<void>;
/**
 * Run one replay batch for a session under exclusive use of its guard.
 * While the batch runs, `sendSessionUpdate` calls for the SAME session (live
 * turn dispatch) queue behind it; the batch's own sends go through
 * `replayMessages`, which notifies directly — that bypass is what makes the
 * batch atomic without a re-entrant lock. Concurrent batches serialize.
 */
export declare function withReplayBatch<T>(sessionId: string, fn: () => Promise<T>): Promise<T>;
/** Send an `agent_message_chunk` text notification. */
export declare function sendTextChunk(cx: acp.AgentContext, sessionId: string, text: string, messageId: string): Promise<void>;
/**
 * Echo an incoming `session/prompt` to every OTHER client as a
 * `user_message_chunk`. ACP clients render their own outgoing prompt locally
 * and never re-broadcast it, so without this echo a turn driven from one
 * client (editor tab or remote attach) shows up on the others without the
 * user message that started it. The prompting client is excluded — it would
 * render the echo as a duplicate of what it already appended. Fire-and-forget;
 * best-effort (failures warn and never break the prompt).
 */
export declare function echoUserPromptToOthers(server: ZcodeAcpServer, prompter: acp.AgentContext, params: {
    sessionId: string;
    prompt: acp.PromptRequest["prompt"];
}): void;
/**
 * Does this cx already reach every client by itself? The broadcast proxy
 * (ClientRegistry.broadcast()) has no `connectionContext` — exactly the field
 * `notifyOthers` filters on — so for a proxy source the "others" fan-out would
 * duplicate the base send on every client. Handlers registered with the proxy
 * (extension methods, slash interception, the prompt turn loop) must pair
 * `sendSessionUpdate` with `sendSessionUpdateToOthers` ONLY for real
 * per-connection contexts.
 */
export declare function isBroadcastSource(cx: acp.AgentContext): boolean;
/**
 * Push a `session/update` to every OTHER attached client (the prompter's
 * connection excluded). Session settings are per-SESSION, not per-connection:
 * a model/mode switch made from the phone must reach the CLI window and vice
 * versa — a cx-addressed send alone leaves every other view stale. Same
 * alias fan-out as the prompt echo (clients may hold the conversation under
 * different ids). Fire-and-forget; failures warn, never throw.
 */
export declare function sendSessionUpdateToOthers(server: ZcodeAcpServer, source: acp.AgentContext, sessionId: string, update: acp.SessionUpdate): void;
/** Shape of a slash command entry (matches ACP's AvailableCommand). */
interface SlashCommandEntry {
    name: string;
    description: string;
    input?: {
        hint: string;
    };
}
/** Send an `available_commands_update` notification listing our slash commands. */
export declare function sendAvailableCommands(cx: acp.AgentContext, sessionId: string, commands: ReadonlyArray<SlashCommandEntry>): Promise<void>;
/**
 * Does this client see the `$` skill-name grouping? The prefix is a DISPLAY
 * convention for editors (Zed groups skills visually under `$`); martty and
 * unnamed clients (the remote App sends no clientInfo) surface commands by
 * typing `/` — a `$`-prefixed name never matches there, hiding every skill.
 * Both spellings route identically (slash.ts accepts bare and `$`-prefixed
 * skill names), so per-client display is safe.
 */
export declare function skillPrefixForClient(name: string | null): string;
/**
 * Send `available_commands_update` with a PER-CLIENT command list: skill names
 * keep their `$` prefix for grouping-capable editors and lose it for martty /
 * unnamed clients (see `skillPrefixForClient`).
 */
export declare function sendAvailableCommandsPerClient(registry: ClientRegistry, sessionId: string, commands: ReadonlyArray<SlashCommandEntry>): Promise<void>;
/**
 * Send `available_commands_update` after a short delay so it lands after the
 * session response. ACP clients initialize their session state machine on the
 * response; a notification arriving earlier can be dropped, leaving the `/`
 * completion menu empty.
 *
 * The notification is fired three times (50ms / 300ms / 1000ms) to cover slow
 * client warm-up: on a fresh Zed tab the session view may still be initialising
 * at the 50ms mark, dropping the first notification. `available_commands_update`
 * is overwrite-semantics (not additive), so repeats are harmless — the client
 * keeps the latest snapshot. Fire-and-forget (returns void).
 *
 * Each call cancels any still-pending timers from a prior call for the same
 * session, so a rapid sequence (e.g. load then resume) can't have an old
 * timer overwrite the newest command list.
 */
export declare function sendAvailableCommandsDeferred(registry: ClientRegistry, sessionId: string, commands: ReadonlyArray<SlashCommandEntry>): void;
/** Throw a JSON-RPC error from a handler (the SDK converts it to an error response). */
export declare function throwError(code: number, message: string): never;
/** Server instance attached to the running agent (set by index.ts on connect). */
export interface ServerHolder {
    server: ZcodeAcpServer;
}
export {};
//# sourceMappingURL=io.d.ts.map