/**
 * Internal event-dict shape — the seam between translators and the dispatcher.
 *
 * Both `EventTranslator` (event-stream path) and `ProjectionDiffer` (snapshot
 * path) emit these discriminated unions; `dispatchEvent` consumes them and
 * serialises each into an ACP `session/update` notification.
 */
/** A plan entry being built before dispatch (status/priority are normalised here). */
export function makePlanEntry(content, status, priority) {
    return {
        content,
        status: normalisePlanStatus(status),
        priority: normalisePlanPriority(priority),
    };
}
function normalisePlanStatus(s) {
    if (s === "completed" || s === "in_progress" || s === "pending") {
        return s;
    }
    return "pending";
}
function normalisePlanPriority(p) {
    if (p === "high" || p === "medium" || p === "low")
        return p;
    return "medium";
}
//# sourceMappingURL=types.js.map