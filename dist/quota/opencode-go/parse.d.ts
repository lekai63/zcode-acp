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
import type { GoWindow } from "./types.js";
/** Result of parsing the status payload — each window is independently optional. */
export interface ParsedGoStatus {
    rolling: GoWindow | null;
    weekly: GoWindow | null;
    monthly: GoWindow | null;
    /**
     * True when the body parsed and carries the status shape but no window
     * matched — the API layout changed (parser rot).
     */
    parserOutdated: boolean;
}
/** Detect the status payload shape (`access.meters`) — the parser-rot guard. */
export declare function looksLikeGoStatus(parsed: unknown): boolean;
export declare function parseGoStatus(text: string, now?: number): ParsedGoStatus;
//# sourceMappingURL=parse.d.ts.map