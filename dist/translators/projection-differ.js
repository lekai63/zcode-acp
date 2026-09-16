/**
 * ProjectionDiffer: diff two `{projection, messages, todos}` snapshots into
 * internal events.
 *
 * Used in three places:
 *   1. Turn completion — emit the final PlanUpdate / usage (text/tools are
 *      already deduped by seenMessageIds).
 *   2. Stall reconciliation — recover missed events from an authoritative
 *      `session/messages` snapshot.
 *   3. session/load — replay an initial plan.
 *
 * Only NEW messages (by message id dedup) are processed, so multi-turn/resume
 * history isn't re-emitted. The PlanUpdate fires whenever the todos signature
 * changes (including clearing to empty — the initial `_lastPlanSig = "__none__"`
 * makes the first empty list also emit).
 */
import { buildDiffContent, buildResultContent, extractLocations, renderToolOutput, summarizeToolInput, TOOL_KIND_MAP, } from "./tool-helpers.js";
import { makePlanEntry } from "./types.js";
const TOOL_STATUS_MAP = {
    pending: "pending",
    running: "in_progress",
    completed: "completed",
    error: "failed",
};
export class ProjectionDiffer {
    seenToolIds = new Set();
    lastToolStatus = new Map();
    lastUsage = null;
    seenMessageIds = new Set();
    lastPlanSig = "__none__";
    seenPatchHashes = new Set();
    /** Whether any TextDelta fired this turn (used by fallback detection). */
    emittedTextThisTurn = false;
    /** Mark all given messages as seen (baseline so we don't re-emit history). */
    markSeen(messages) {
        for (const m of messages) {
            const key = this.messageDedupKey(m);
            if (key)
                this.seenMessageIds.add(key);
        }
    }
    /** Whether a message's dedup key has already been processed. */
    hasSeenMessage(m) {
        const key = this.messageDedupKey(m);
        return key !== null && this.seenMessageIds.has(key);
    }
    /**
     * Mark a tool call id as seen + completed. Used to sync state from the
     * EventTranslator so the next `diff()` won't re-emit a tool the event path
     * already dispatched (which would clear Bash terminal output via a
     * content-less ToolCallNew through the terminal path).
     */
    markToolSeen(callId) {
        this.seenToolIds.add(callId);
        this.lastToolStatus.set(callId, "completed");
    }
    /** Reset per-turn flags (does NOT reset seenMessageIds). */
    resetTurn() {
        this.emittedTextThisTurn = false;
    }
    /** Set the usage baseline so the next diff won't re-emit the same value. */
    setLastUsage(used) {
        this.lastUsage = used;
    }
    /** Diff two snapshots. Returns 0..n events. */
    diff(curSnapshot) {
        const events = [];
        const curProj = (curSnapshot?.projection ?? {});
        const curMsgs = curSnapshot?.messages ?? [];
        // 1. usage_update: prefer contextUsed (current occupancy) over totalTokenCount
        //    (cumulative). `||` so an explicit contextUsed=0 falls back to totalTokenCount.
        const used = curProj.contextUsed || curProj.totalTokenCount || 0;
        const size = curProj.contextWindow ?? 0;
        if (this.lastUsage === null || used !== this.lastUsage) {
            if (size > 0)
                events.push({ kind: "UsageDelta", used, size });
            this.lastUsage = used;
        }
        // 2. Only NEW messages (dedup by id).
        for (const m of curMsgs) {
            const dedupKey = this.messageDedupKey(m);
            if (dedupKey && this.seenMessageIds.has(dedupKey))
                continue;
            if (dedupKey)
                this.seenMessageIds.add(dedupKey);
            const role = m.info?.role;
            for (const p of m.parts ?? []) {
                if (!p || typeof p !== "object")
                    continue;
                const ptype = p.type;
                if (ptype === "tool") {
                    events.push(...this.diffToolPart(p));
                }
                else if (ptype === "text" && role === "assistant") {
                    const text = p.text ?? "";
                    if (text.trim()) {
                        events.push({ kind: "TextDelta", text, messageId: m.info.id });
                        this.emittedTextThisTurn = true;
                    }
                }
                else if (ptype === "reasoning") {
                    const text = p.text ?? "";
                    if (text.trim())
                        events.push({ kind: "ReasoningDelta", text, messageId: m.info.id });
                }
                else if (ptype === "patch") {
                    const ph = p.hash;
                    if (ph && !this.seenPatchHashes.has(ph)) {
                        this.seenPatchHashes.add(ph);
                        events.push({ kind: "FilesChanged", files: p.files ?? [] });
                    }
                }
            }
        }
        // 3. plan (todos) — including clearing to empty.
        events.push(...this.diffPlan(curSnapshot?.todos));
        return events;
    }
    /**
     * Detect a todos signature change and return a PlanUpdate event if it changed
     * (including clearing to empty — the initial `_lastPlanSig = "__none__"` makes
     * the first empty list also emit). Exposed so callers can run plan detection
     * mid-turn (e.g. right after a TodoWrite tool completes) without a full diff,
     * avoiding the lag of waiting until turn completion.
     */
    diffPlan(todos) {
        const list = (todos ?? []);
        const sig = stableStringify(list);
        if (sig === this.lastPlanSig)
            return [];
        this.lastPlanSig = sig;
        const entries = list.map((t) => makePlanEntry(String(t["content"] ?? ""), String(t["status"] ?? "pending"), String(t["priority"] ?? "medium")));
        return [{ kind: "PlanUpdate", entries }];
    }
    diffToolPart(p) {
        const events = [];
        const callId = String(p["callID"] ?? p["callId"] ?? "");
        if (!callId)
            return events;
        const toolName = String(p["tool"] ?? "other");
        const state = p["state"] ?? {};
        const status = String(state["status"] ?? "pending");
        if (!this.seenToolIds.has(callId)) {
            this.seenToolIds.add(callId);
            this.lastToolStatus.set(callId, status);
            const input = state["input"];
            const summary = summarizeToolInput(toolName, input);
            const newEv = {
                kind: "ToolCallNew",
                callId,
                tool: toolName,
                acpKind: (TOOL_KIND_MAP[toolName] ?? "other"),
                status: (TOOL_STATUS_MAP[status] ?? "other"),
                title: summary ? `${toolName}: ${summary}` : toolName,
            };
            if (input !== undefined)
                newEv.input = input;
            const display = state["metadata"]?.["display"];
            if (status === "completed" || status === "error") {
                const outPayload = state["output"] ?? state["error"];
                newEv.output = renderToolOutput(outPayload);
                const diff = buildDiffContent(display);
                if (diff.length > 0) {
                    newEv.diffContent = diff;
                }
                else {
                    const rc = buildResultContent(toolName, outPayload, status === "error");
                    if (rc.length > 0)
                        newEv.content = rc;
                }
            }
            const locs = extractLocations(toolName, input, display);
            if (locs.length > 0)
                newEv.locations = locs;
            events.push(newEv);
        }
        else if (status !== this.lastToolStatus.get(callId)) {
            // Status transition on a seen tool. On completed/error, carry the rich
            // payload (output / diff / content / locations) like the new-tool branch,
            // so snapshot-path transitions aren't content-less.
            this.lastToolStatus.set(callId, status);
            const display = state["metadata"]?.["display"];
            const update = {
                kind: "ToolCallUpdate",
                callId,
                tool: toolName,
                status: (TOOL_STATUS_MAP[status] ?? "other"),
            };
            if (status === "completed" || status === "error") {
                const outPayload = state["output"] ?? state["error"];
                update.output = renderToolOutput(outPayload);
                const diff = buildDiffContent(display);
                if (diff.length > 0) {
                    update.diffContent = diff;
                }
                else {
                    const rc = buildResultContent(toolName, outPayload, status === "error");
                    if (rc.length > 0)
                        update.content = rc;
                }
                const locs = extractLocations(toolName, state["input"], display);
                if (locs.length > 0)
                    update.locations = locs;
            }
            events.push(update);
        }
        return events;
    }
    messageDedupKey(m) {
        const info = (m.info ?? {});
        const msgId = info.id;
        if (msgId)
            return msgId;
        const role = info.role ?? "?";
        try {
            const sig = stableStringify(m.parts ?? []).slice(0, 200);
            return `__fallback::${role}::${sig}`;
        }
        catch {
            return `__fallback::${role}::${String(m.parts).slice(0, 200)}`;
        }
    }
}
/** Deterministic JSON string with recursively sorted object keys, mirroring
 *  Python's `json.dumps(..., sort_keys=True)` so signatures are stable regardless
 *  of key insertion order. */
function stableStringify(value) {
    try {
        return JSON.stringify(sortKeys(value));
    }
    catch {
        return String(value);
    }
}
function sortKeys(value) {
    if (Array.isArray(value))
        return value.map(sortKeys);
    if (value && typeof value === "object") {
        const obj = value;
        return Object.keys(obj)
            .sort()
            .reduce((acc, k) => {
            acc[k] = sortKeys(obj[k]);
            return acc;
        }, {});
    }
    return value;
}
//# sourceMappingURL=projection-differ.js.map