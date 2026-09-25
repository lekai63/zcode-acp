/**
 * Opencode Go status JSON parser.
 *
 * The console API (`/console/api/go/status`) returns meter pairs in
 * micro-cents per window; we compute the percent (used/limit) and the reset
 * countdown (resetsAt − now) here — the API gives absolute timestamps, the
 * formatter wants a relative countdown captured at fetch time.
 *
 * Window mapping:
 *   rolling ← meters.fiveHour (resetsAt is null while the window is idle → 0)
 *   weekly  ← meters.week
 *   monthly ← meters.month (carries no resetsAt — anchored to access.endsAt,
 *             the subscription renewal instant)
 */
function microCents(v) {
    const n = typeof v === "number" ? v : v === undefined ? Number.NaN : Number(v);
    return Number.isFinite(n) ? n : null;
}
function windowFrom(meter, fallbackResetAt, now) {
    if (!meter)
        return null;
    const used = microCents(meter.usedMicroCents);
    const limit = microCents(meter.limitMicroCents);
    if (used === null || limit === null || limit <= 0)
        return null;
    const usagePercent = Math.min(100, (used / limit) * 100);
    const resetMs = meter.resetsAt ?? fallbackResetAt;
    const at = resetMs !== undefined ? Date.parse(resetMs) : Number.NaN;
    const resetInSec = Number.isFinite(at) ? Math.max(0, Math.round((at - now) / 1000)) : 0;
    return { usagePercent, resetInSec };
}
/** Detect the status payload shape (`access.meters`) — the parser-rot guard. */
export function looksLikeGoStatus(parsed) {
    const meters = parsed?.access?.meters;
    return typeof meters === "object" && meters !== null;
}
export function parseGoStatus(text, now = Date.now()) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        return { rolling: null, weekly: null, monthly: null, parserOutdated: false };
    }
    const access = parsed
        ?.access;
    const meters = access?.meters;
    if (typeof meters !== "object" || meters === null) {
        return { rolling: null, weekly: null, monthly: null, parserOutdated: false };
    }
    const rolling = windowFrom(meters.fiveHour, undefined, now);
    const weekly = windowFrom(meters.week, undefined, now);
    const monthly = windowFrom(meters.month, access?.endsAt, now);
    return {
        rolling,
        weekly,
        monthly,
        parserOutdated: !rolling && !weekly && !monthly,
    };
}
//# sourceMappingURL=parse.js.map