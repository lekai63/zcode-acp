/**
 * Native guide-steer: `_zcode/guide` hands a mid-turn message to the running
 * backend turn instead of preempting it with a second `session/prompt`.
 *
 * ZCode's own "guide" (Desktop's follow-up mode) is the v4 `sendText` command
 * with `requestedDelivery: "guide"` (ZCode source: bootstrap
 * zcode-protocol-v4/commands/handlers/session-flow.ts → core
 * runtime/methods/prompt-admission.ts). On a steerable turn the input is
 * queued on that turn (`turn.steerQueued`) and injected as a user message at
 * the next model-step boundary — after a tool batch, or after a text-only
 * step, which then keeps the turn going (`turn.steerDrained`). When the turn
 * cannot take it any more (stopped by a tool, not steerable, interrupted) it
 * lands in the session queue instead; a backend that was already idle starts
 * it as its own turn (ack delivery `startNow`).
 *
 * The ACP prompt that owns the running turn stays open until every guide was
 * consumed: runOneTurn chains a follow-up round (awaitGuideFollowUp) when its
 * turn ended with a guide still queued. One bridge-specific gap: ZCode drains
 * its queue only after turns started through v4, never after a legacy
 * `session/send` turn (server-operations.ts runPromptTurnInBackground ends in
 * afterStateMutation, which has no auto-drain), so the follow-up resumes the
 * queue itself with `setAutoDrain` — the native, idle-only promotion.
 *
 * Text only: V4 attachments are refs and a guide with attachments is demoted
 * to the queue anyway. Slash commands keep the regular prompt path (the bridge
 * intercepts them there).
 */
import { randomUUID } from "node:crypto";
import { messages } from "../i18n.js";
import { log, warn } from "../utils.js";
import { echoUserPromptToOthers, sendTextChunk } from "./io.js";
const CLIENT_ID = "zcode-acp-server";
const COMMAND_TIMEOUT_MS = 15_000;
/** How long a finished turn waits for its queued guide's own turn to start. */
const FOLLOW_UP_TIMEOUT_MS = 45_000;
/**
 * The finished legacy turn broadcasts `state.updated {prompt_completed}` once
 * its bookkeeping released the session; the queue is resumed after that, or
 * after this grace when the broadcast never shows.
 */
const LEGACY_TERMINAL_GRACE_MS = 3_000;
const RESUME_QUEUE_RETRY_MS = 5_000;
const CAS_ATTEMPTS = 4;
/** `_zcode/guide` handler. Never throws: "unavailable" tells the client to fall back. */
export async function guide(server, params, client) {
    const blocks = Array.isArray(params.prompt) ? params.prompt : [];
    if (blocks.length === 0 || blocks.some((b) => b?.type !== "text")) {
        return { outcome: "unavailable", reason: "unsupported_content" };
    }
    const text = blocks
        .map((b) => b.text ?? "")
        .join("\n")
        .trim();
    if (!text)
        return { outcome: "unavailable", reason: "empty" };
    if (text.startsWith("/"))
        return { outcome: "unavailable", reason: "slash_command" };
    const zcodeSid = server.sessionMap.get(params.sessionId);
    const turn = zcodeSid ? findGuidableTurn(server, zcodeSid) : undefined;
    if (!zcodeSid || !turn)
        return { outcome: "unavailable", reason: "no_active_turn" };
    // Registered synchronously, before the first await: from here on the turn
    // loop cannot end the prompt behind this guide's back.
    const commandId = randomUUID();
    const entry = { commandId, state: "sending" };
    turn.guides ??= new Map();
    turn.guides.set(commandId, entry);
    let ack;
    try {
        ack = await sendCommand(server, zcodeSid, commandId, "sendText", {
            text,
            requestedDelivery: "guide",
            // Only consulted when the session queue is held (paused after a stop or
            // a failed turn): keep it and deliver this input anyway. Without it a
            // held queue rejects every sendText with heldQueueDispositionRequired.
            heldQueueDisposition: "keepQueueAndSend",
        });
    }
    catch (e) {
        turn.guides.delete(commandId);
        const reason = e instanceof Error ? e.message : String(e);
        warn(`guide: v4 sendText failed for ${zcodeSid}: ${reason}`);
        return { outcome: "unavailable", reason: `backend_error: ${reason}` };
    }
    if (ack.status !== "accepted" && ack.status !== "duplicate") {
        turn.guides.delete(commandId);
        const reason = ack.reasonCode ?? ack.message ?? ack.status ?? "rejected";
        log(`guide: v4 sendText ${ack.status ?? "?"} for ${zcodeSid} (${reason})`);
        return { outcome: "unavailable", reason: `rejected: ${reason}` };
    }
    entry.state = "accepted";
    entry.delivery = ack.result?.delivery ?? "queue";
    log(`guide: accepted for ${zcodeSid} (delivery=${entry.delivery}, input ${commandId})`);
    if (client)
        echoUserPromptToOthers(server, client, params);
    return { outcome: "guided", inputId: commandId, delivery: entry.delivery };
}
/** The live prompt turn a guide can ride on, if any. */
function findGuidableTurn(server, zcodeSid) {
    let found;
    for (const turn of server.pendingTurns.values()) {
        if (turn.zcodeSid !== zcodeSid || turn.cancelled || turn.goalLoop)
            continue;
        if (!turn.sendAccepted || !turn.guideReady || turn.guideClosed)
            continue;
        found = turn;
    }
    return found;
}
/** True while a guide of this turn has not reached the model yet. */
export function hasOpenGuides(turn) {
    return (turn.guides?.size ?? 0) > 0;
}
function guideFor(turn, inputId) {
    return typeof inputId === "string" ? turn.guides?.get(inputId) : undefined;
}
/**
 * Guide bookkeeping for one backend event. Returns true when the event was a
 * steer event of one of this turn's guides — the caller must neither drop it
 * as attribution residue nor read it as a swallowed send.
 */
export function noteGuideEvent(turn, ev) {
    if (!turn.guides?.size)
        return false;
    const payload = (ev.payload ?? {});
    if (ev.type === "turn.steerQueued") {
        const entry = guideFor(turn, payload["inputId"]) ?? guideFor(turn, payload["queryId"]);
        if (!entry)
            return false;
        const intent = payload["intent"];
        const queueItemId = typeof intent?.queueItemId === "string" ? intent.queueItemId : payload["pendingInputId"];
        if (typeof queueItemId === "string")
            entry.queueItemId = queueItemId;
        log(`  [guide] queued on the backend (${String(payload["delivery"] ?? "?")})`);
        return true;
    }
    if (ev.type === "turn.steerDrained") {
        const pendingIds = new Set(asStrings(payload["pendingInputIds"]));
        const queryIds = new Set(asStrings(payload["queryIds"]));
        let matched = false;
        for (const [commandId, entry] of turn.guides) {
            if (queryIds.has(commandId) || (entry.queueItemId && pendingIds.has(entry.queueItemId))) {
                turn.guides.delete(commandId);
                matched = true;
                log(`  [guide] delivered into the running turn (input ${commandId})`);
            }
        }
        return matched;
    }
    return false;
}
function asStrings(value) {
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}
/** True when `ev` starts the turn that carries one of this turn's guides. */
function isGuideTurnStart(turn, ev) {
    if (ev.type !== "turn.started")
        return false;
    const payload = (ev.payload ?? {});
    return Boolean(guideFor(turn, payload["inputId"]) ?? guideFor(turn, payload["queryId"]));
}
/**
 * The prompt's turn ended while a guide was still open: wait for the turn
 * that carries it, resuming the session queue when it does not start on its
 * own. On "turn" the guide turn's `turn.started` is back at the head of the
 * listener, and its entry is closed — the follow-up round owns it now.
 * `staleTerminal`: the finished turn's `prompt_completed` broadcast has not
 * arrived yet, so the follow-up round must not read it as its own.
 */
export async function awaitGuideFollowUp(server, deps) {
    const { turn, listener, zcodeSid, acpSid, cx } = deps;
    const t0 = Date.now();
    let sawLegacyTerminal = turn.stallRecovered === true;
    let lastResumeAt = 0;
    while (true) {
        if (turn.cancelled)
            return { kind: "cancelled" };
        if (!hasOpenGuides(turn))
            return { kind: "none" };
        if (Date.now() - t0 > FOLLOW_UP_TIMEOUT_MS) {
            warn(`guide: no turn started for ${turn.guides.size} queued guide(s) on ${zcodeSid}`);
            await discardOpenGuides(server, turn, zcodeSid);
            await sendTextChunk(cx, acpSid, messages().guideNotDelivered, randomUUID()).catch(() => undefined);
            return { kind: "none" };
        }
        const queued = [...turn.guides.values()].some((g) => g.state === "accepted" && g.delivery !== "startNow");
        if (queued &&
            (sawLegacyTerminal || Date.now() - t0 > LEGACY_TERMINAL_GRACE_MS) &&
            Date.now() - lastResumeAt > RESUME_QUEUE_RETRY_MS) {
            lastResumeAt = Date.now();
            await resumeQueue(server, zcodeSid);
        }
        const ev = await listener.pollEvent(200);
        if (!ev)
            continue;
        if (noteGuideEvent(turn, ev))
            continue;
        if (isGuideTurnStart(turn, ev)) {
            const payload = (ev.payload ?? {});
            const id = String(payload["inputId"] ?? payload["queryId"]);
            turn.guides.delete(id);
            listener.requeueFront(ev);
            log(`  [guide] follow-up turn started for input ${id}`);
            return { kind: "turn", staleTerminal: !sawLegacyTerminal };
        }
        if (ev.type === "state.updated") {
            const reason = ev.payload?.reason;
            if (reason === "prompt_completed" || reason === "prompt_failed")
                sawLegacyTerminal = true;
        }
        // Anything else is the finished turn's tail — already reconciled by its
        // completion diff.
    }
}
/**
 * `setAutoDrain {autoDrain:true}`: ZCode's own "resume queue" — promotes the
 * queue head once the session is idle (and arms a retry while it is busy),
 * never preempting anything.
 */
async function resumeQueue(server, zcodeSid) {
    try {
        const ack = await sendCasCommand(server, zcodeSid, "setAutoDrain", { autoDrain: true });
        log(`  [guide] queue resume ${ack.status ?? "?"}${ack.reasonCode ? ` (${ack.reasonCode})` : ""}`);
    }
    catch (e) {
        warn(`guide: queue resume failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}
/**
 * Drop the guides that never reached the model (the prompt was cancelled or
 * failed): their queue items would otherwise sit in the session's queue and
 * surface as a paused queue in Desktop. Best-effort.
 */
export async function discardOpenGuides(server, turn, zcodeSid) {
    const entries = [...(turn.guides?.values() ?? [])];
    turn.guides?.clear();
    if (entries.some((entry) => entry.delivery === "startNow")) {
        // A guide that found the backend idle runs as its own turn, which the
        // prompt's stop pair (aimed at the prompt's own execution id) misses.
        try {
            await sendCommand(server, zcodeSid, randomUUID(), "stop", {});
            log(`guide: stopped the turn of an undelivered guide on ${zcodeSid}`);
        }
        catch (e) {
            warn(`guide: stop failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    for (const entry of entries) {
        if (!entry.queueItemId) {
            if (entry.delivery !== "startNow") {
                log(`guide: open guide ${entry.commandId} has no known queue item — left as is`);
            }
            continue;
        }
        try {
            const ack = await sendCasCommand(server, zcodeSid, "deleteQueueItem", {
                queueItemId: entry.queueItemId,
            });
            log(`guide: discarded queued guide ${entry.queueItemId} (${ack.status ?? "?"})`);
        }
        catch (e) {
            warn(`guide: discard failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
/** Last revision seen per session — the CAS base for the next command. */
const lastRevisions = new Map();
async function sendCommand(server, zcodeSid, commandId, type, payload, baseRevision) {
    const backend = await server.ensureBackend();
    const envelope = {
        commandId,
        clientId: CLIENT_ID,
        sessionId: zcodeSid,
        type,
        payload,
        issuedAt: Date.now(),
    };
    if (baseRevision !== undefined)
        envelope.baseRevision = baseRevision;
    const resp = await backend.request(server.nextId(), "v4/command", envelope, COMMAND_TIMEOUT_MS);
    if (resp.error)
        throw new Error(resp.error.message ?? "v4/command failed");
    const ack = (resp.result ?? {});
    if (typeof ack.revisionAtDecision === "number") {
        lastRevisions.set(zcodeSid, ack.revisionAtDecision);
    }
    return ack;
}
/**
 * A CAS command (`baseRevision` required, ZCode COMMANDS_REQUIRING_BASE_REVISION):
 * a stale ack carries the current revision, so retry with it.
 */
async function sendCasCommand(server, zcodeSid, type, payload) {
    let ack = {};
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
        ack = await sendCommand(server, zcodeSid, randomUUID(), type, payload, lastRevisions.get(zcodeSid) ?? 0);
        if (ack.status !== "stale")
            return ack;
    }
    return ack;
}
//# sourceMappingURL=guide.js.map