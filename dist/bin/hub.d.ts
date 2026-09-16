#!/usr/bin/env node
/**
 * Standalone zcode-acp hub daemon entry.
 *
 * Usually spawned detached by the first bridge that enables remote access
 * (see src/remote/endpoint.ts); running it manually is also fine, e.g. under
 * launchd/systemd or directly for debugging:
 *
 *   ZCODE_ACP_REMOTE_TOKEN=<secret> zcode-acp hub
 *
 * Refuses to start without ZCODE_ACP_REMOTE_TOKEN — the hub is the only public
 * entry point and never runs unauthenticated. Exits 0 on EADDRINUSE: another
 * hub already owns the port, which is the desired machine-singleton behaviour.
 *
 * If the hub finds itself INSIDE our Seatbelt wrap (ZCODE_ACP_SANDBOX_ACTIVE,
 * birth-marked onto every sandboxed backend spawn and inherited down the
 * chain), it relaunches itself via launchd — which lives OUTSIDE the sandbox —
 * before binding: a sandboxed hub cannot open the visible session terminal
 * (macOS TCC refuses the request attributed to "Sandbox"), and Seatbelt can
 * never be escaped from within. See src/remote/hub-sandbox.ts.
 */
export declare function main(): Promise<void>;
//# sourceMappingURL=hub.d.ts.map