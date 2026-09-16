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
 * details) and one Opencode Go section (rolling/weekly/monthly windows, the
 * relative reset countdown converted to an absolute timestamp). Provider
 * failures are reported per-section as `kind` strings rather than throwing —
 * the client renders the same status line the CLI would (a `not_configured`
 * Go section is simply omitted, matching the CLI).
 */
import type { GoQueryResult, GoWindowKey } from "../quota/opencode-go/types.js";
import type { QuotaItem, QuotaResult } from "../quota/types.js";
/** GLM section — `items` present only on success. */
export interface GlmUsageStats {
    kind: QuotaResult["kind"];
    level?: string;
    items?: QuotaItem[];
}
/** One Opencode Go window with the reset countdown resolved to epoch ms. */
export interface GoWindowEntry {
    key: GoWindowKey;
    label: string;
    usagePercent: number;
    resetsAt: number;
}
/** Opencode Go section — `windows` present only on success. */
export interface GoUsageStats {
    kind: GoQueryResult["kind"];
    windows?: GoWindowEntry[];
}
export interface UsageStatsResult {
    glm: GlmUsageStats;
    opencode: GoUsageStats;
}
/** `account/usage_stats` handler — both providers, queried in parallel. */
export declare function accountUsageStats(): Promise<UsageStatsResult>;
//# sourceMappingURL=account.d.ts.map