/**
 * Settings API routes (ADR-0025), served on the bridge's loopback server and
 * re-served by the hub behind the token.
 *
 * The handler is a single factory mounted in both places, so the two routes
 * cannot drift. Everything here is a thin translation layer over
 * `src/settings/*`: parse the request, call the module, map the outcome to a
 * status code and an **effect class** the client can act on.
 *
 * Effect classes are the contract's most important field. A write answers
 * `immediate` when the running backend picks it up by itself (the provider
 * table is polled every ~1s; skills enablement is read live) and
 * `needs-restart` when the agent read it once at startup (MCP servers, hooks,
 * subagent markdown). A client that ignores this shows the user a toggle that
 * appears to do nothing.
 *
 * Error mapping is deliberately coarse — the module's messages are already
 * actionable, so they are passed through as `error` rather than re-coded.
 * Only the validation failures that indicate a malformed request get a 400;
 * an unreachable or failing upstream gets 502/504 (the request may still have
 * been carried out, so the client retries with the same idempotency key);
 * everything else is a 500, because it means the environment is wrong.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZcodeAcpServer } from "../server.js";
/**
 * Build the settings router.
 *
 * `server` is the bridge to operate on. It is only needed by
 * `/settings/backend/restart`, which has a backend to restart; the hub's
 * machine-level mount passes none and answers 501 on that route. Passing it
 * through the closure (rather than a module singleton) keeps two bridges in one
 * process — a test, or a future multi-workspace mode — from disturbing each
 * other's backend.
 *
 * Routes are matched on `url.pathname` after an optional `/api` prefix is
 * stripped, so one factory serves `/settings/…` on the loopback server and
 * `/api/settings/…` on the hub.
 */
export declare function createSettingsHandler(server?: ZcodeAcpServer): (req: IncomingMessage, res: ServerResponse) => void;
/** Test seam: drop the counter so a suite starts from a known state. */
export declare function resetPendingRestartForTest(): void;
/** Record the nonce a status read just issued. */
export declare function rememberResetNonce(providerId: string, nonce: string): void;
/** Test seam: drop the install state so a suite starts from a known one. */
export declare function resetAppUpdateStateForTest(): void;
//# sourceMappingURL=settings-endpoint.d.ts.map