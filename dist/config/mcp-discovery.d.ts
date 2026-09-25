/**
 * MCP server discovery — reads MCP server configurations from the same sources
 * ZCode uses, so `/mcp` can show users exactly which servers are available.
 *
 * Sources:
 *   1. <zcode-home>/cli/config.json → mcp.servers (user-configured)
 *   2. Enabled plugin .mcp.json files (two formats: flat and nested)
 *
 * `<zcode-home>` is the ZCode data root (`~/.zcode`, or `$ZCODE_HOME` when
 * set — see `zcodeHomeDir()`).
 *
 * The ZCode backend loads these automatically and exposes their tools to the
 * model. This module is purely informational — it lists what's configured so
 * users know what's available without needing the TUI.
 */
/** Information about a discovered MCP server. */
export interface McpServerInfo {
    name: string;
    type: string;
    command?: string;
    args?: string[];
    url?: string;
    source: string;
}
/**
 * Discover all MCP servers from config.json and enabled plugins.
 *
 * Best-effort: failures are logged and swallowed.
 */
export declare function loadMcpServers(): McpServerInfo[];
/**
 * Format MCP servers into a human-readable card for the `/mcp` command.
 *
 * Groups by source (config vs plugins) and aligns columns for readability.
 */
export declare function formatMcpServers(servers: McpServerInfo[]): string;
/**
 * Per-server health from the backend `mcp/list` RPC with `mode:"status"`
 * (zcodeMcpServerStatusSnapshot): per-server health WITHOUT connecting.
 * `failureKind` and `authorizationUrl` are present only when set.
 */
export interface McpServerHealth {
    status: string;
    toolCount: number;
    failureKind?: string;
    authorizationUrl?: string;
}
/**
 * Format the backend's live MCP health map into a card for `/mcp`.
 *
 * One line per server — `name · status · N tools · failureKind` (failureKind
 * only when present, raw enum value) — with a pending OAuth authorizationUrl
 * indented on its own line beneath its server.
 */
export declare function formatMcpServerHealth(statuses: Record<string, McpServerHealth>): string;
//# sourceMappingURL=mcp-discovery.d.ts.map