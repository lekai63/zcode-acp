/**
 * ZCode app-server protocol type definitions.
 *
 * ZCode speaks a line-delimited JSON protocol over stdio. It is JSON-RPC-like
 * but deliberately omits the `jsonrpc` field. Messages are classified by the
 * presence of `id` and `method`:
 *   - id + no method        → response to a request we sent
 *   - id + method           → either our response (id registered) or a server→client request
 *   - method + no id        → notification (e.g. `session/event`)
 *
 * Only the fields we actually consume are typed; the rest pass through as
 * `unknown`/`Record<string, unknown>` to stay resilient to ZCode schema drift.
 */
export {};
//# sourceMappingURL=types.js.map