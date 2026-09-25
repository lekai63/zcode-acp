/**
 * App usage stats, aggregated from the local agent database.
 *
 * The desktop app's App Usage panel reads `~/.zcode/cli/db/db.sqlite`
 * (`model_usage` / `turn_usage` / `tool_usage`). Rather than proxying the
 * backend's `usage/stats` RPC — which couples a settings screen to a live
 * backend process and whose `.strict()` params turn any schema drift into a
 * hard failure — the same tables are aggregated here in read-only mode
 * (ADR-0027).
 *
 * Two things this module is careful about:
 *
 *  - **Never blocking the writer.** The connection is opened read-only and every
 *    query is a bounded aggregate. A `SQLITE_BUSY` degrades to the same
 *    `available: false` shape a missing database produces, because the caller
 *    renders an empty state either way.
 *  - **Never claiming data that is not there.** A machine that never ran an
 *    agent has no database; that is a normal state, so the response says
 *    `available: false` with zero values instead of erroring.
 *
 * Day buckets use the process timezone offset. The app does the same and notes
 * the same ≤1h DST imprecision; for a usage overview that is not worth the
 * complexity of a per-request timezone.
 */
export type UsageRange = "7d" | "30d" | "all";
export interface ModelUsageRow {
    modelId: string | null;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    requestCount: number;
    /** Fraction of the window's total tokens, 0..1. */
    share: number;
}
export interface DailyUsageRow {
    /** Local calendar day, `YYYY-MM-DD`. */
    date: string;
    models: Array<{
        modelId: string | null;
        totalTokens: number;
    }>;
}
export interface UsageSnapshot {
    /** false when the database is absent — an empty state, not an error. */
    available: boolean;
    range: UsageRange;
    summary: {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        reasoningTokens: number;
        cacheReadTokens: number;
        requestCount: number;
        sessionCount: number;
        turnCount: number;
        toolCallCount: number;
        models: number;
        activeDays: number;
    };
    models: ModelUsageRow[];
    daily: DailyUsageRow[];
}
/**
 * Aggregate the window.
 *
 * Two queries: one per-model roll-up, one per-day roll-up. Both are grouped
 * server-side by sqlite, so the bridge transfers only the aggregated rows —
 * the raw table on a developed machine holds tens of thousands of rows.
 */
export declare function readUsageStats(range?: UsageRange): Promise<UsageSnapshot>;
//# sourceMappingURL=usage-stats.d.ts.map