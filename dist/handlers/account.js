/**
 * Account-level usage stats — Proposal 0002 (`account/usage_stats`).
 *
 * Exposes the combined dual-provider quota behind the `zcode-acp quota` CLI
 * (GLM Coding Plan + Opencode Go) to remote clients as a pull-only ACP
 * method, callable any time after `initialize` (no session required — quota
 * is account-level, so it fits no `session/update` kind).
 *
 * The response mirrors the CLI card's data model so clients can reproduce it
 * exactly: one GLM section (plan level + per-window items with per-model
 * details), one Opencode Go section (rolling/weekly/monthly windows, the
 * relative reset countdown converted to an absolute timestamp), and one
 * Ollama Cloud section (session/weekly/monthly fractions as percents, with
 * the derived reset moments when available — the API itself returns none).
 * Provider failures are reported per-section as
 * `kind` strings rather than throwing — the client renders the same status
 * line the CLI would (a `not_configured` section is simply omitted, matching
 * the CLI).
 */
import { queryCombined } from "../quota/combined.js";
/** Window labels matching the CLI's card (`5h` / `Week` / `Month`). */
const GO_WINDOW_LABELS = {
    rolling: "5h",
    weekly: "Week",
    monthly: "Month",
};
/** GLM items pass through verbatim — the client renders the CLI layout. */
function toGlmStats(result) {
    if (result.kind !== "success")
        return { kind: result.kind };
    return { kind: "success", level: result.level, items: result.items };
}
/**
 * Go windows with the same absolute-reset math the CLI formatter uses:
 * subtract the elapsed time since the fetch snapshot from `resetInSec`.
 */
function toGoStats(result, now = Date.now()) {
    if (result.kind !== "success")
        return { kind: result.kind };
    const elapsedSec = Math.max(0, (now - result.fetchedAt) / 1000);
    const windows = ["rolling", "weekly", "monthly"].flatMap((key) => {
        const w = result[key];
        if (!w)
            return [];
        const remainingSec = Math.max(0, w.resetInSec - elapsedSec);
        return [
            {
                key,
                label: GO_WINDOW_LABELS[key],
                usagePercent: w.usagePercent,
                resetsAt: result.fetchedAt + remainingSec * 1000,
            },
        ];
    });
    return { kind: "success", windows };
}
/**
 * Ollama windows as percents — the API's 0..1 fractions converted once here
 * so remote clients can render the same bar the CLI does. Which windows exist
 * depends on the plan (legacy: session+weekly; credit: monthly). The derived
 * reset moments pass through when present.
 */
function toOcStats(result) {
    if (result.kind !== "success")
        return { kind: result.kind };
    const LABELS = { session: "5h", weekly: "Week", monthly: "Month" };
    const RESETS = {
        session: "sessionResetAt",
        weekly: "weeklyResetAt",
        monthly: "monthlyResetAt",
    };
    const windows = ["session", "weekly", "monthly"].flatMap((key) => {
        if (result[key] === undefined)
            return [];
        const reset = result[RESETS[key]];
        return [
            {
                key,
                label: LABELS[key],
                usagePercent: result[key] * 100,
                ...(typeof reset === "number" && { resetsAt: reset }),
            },
        ];
    });
    return { kind: "success", windows };
}
/** `account/usage_stats` handler — all providers, queried in parallel. */
export async function accountUsageStats() {
    const { glm, go, oc } = await queryCombined("all");
    return { glm: toGlmStats(glm), opencode: toGoStats(go), ollama: toOcStats(oc) };
}
//# sourceMappingURL=account.js.map