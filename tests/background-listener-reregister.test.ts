/**
 * ensureBackgroundListener re-registration across backend respawns.
 *
 * Listeners are registered per ZcodeBackend INSTANCE. A mid-session respawn
 * (sandbox arm-flip, dynamic allow batches, dead-reader recovery) replaces
 * the instance — the cached listener must re-register on the new backend or
 * out-of-band consumption (background tasks, backend titles, sub-agent
 * tracking) silently dies. The prompt path calls ensureBackgroundListener
 * every turn so the heal happens on the next prompt, not only on resume/load.
 */

import { describe, expect, it } from "vitest";

import type { ZcodeBackend } from "../src/backend/client.js";
import { ZcodeAcpServer } from "../src/server.js";

function fakeBackend(): ZcodeBackend & { registered: string[] } {
  const registered: string[] = [];
  return {
    registered,
    isDead: false,
    request: async () => ({ result: {} }),
    send: () => {},
    pollServerRequests: () => [],
    registerEventListener(sid: string, listener: unknown) {
      registered.push(sid);
      void listener;
    },
    unregisterEventListener: () => {},
  } as unknown as ZcodeBackend & { registered: string[] };
}

/**
 * Every out-of-band, session-scoped listener registers under the session id:
 * BackgroundTaskListener + SessionTitleListener + SubagentTracker. They share
 * one registration site (see ZcodeAcpServer.ensureBackgroundListener), so the
 * expected count is asserted as a whole.
 */
const ALL = ["zs_1", "zs_1", "zs_1"];

describe("ensureBackgroundListener across backend respawns", () => {
  it("returns the cached listener on the SAME backend instance", () => {
    const server = new ZcodeAcpServer();
    const backend = fakeBackend();
    server.backend = backend;
    const a = server.ensureBackgroundListener("zs_1");
    const b = server.ensureBackgroundListener("zs_1");
    expect(a).toBe(b);
    // BackgroundTaskListener + SessionTitleListener + SubagentTracker, once.
    expect(backend.registered).toEqual(ALL);
  });

  it("re-registers (every listener) after the backend instance is replaced", () => {
    const server = new ZcodeAcpServer();
    const first = fakeBackend();
    server.backend = first;
    const a = server.ensureBackgroundListener("zs_1");
    expect(first.registered).toEqual(ALL);

    // Respawn: a brand-new instance takes over.
    const second = fakeBackend();
    server.backend = second;
    const b = server.ensureBackgroundListener("zs_1");
    // Same listener object (its per-task state survives), fresh registration
    // of EVERY listener on the new instance — and no duplicate on a third call.
    expect(b).toBe(a);
    expect(second.registered).toEqual(ALL);
    const c = server.ensureBackgroundListener("zs_1");
    expect(c).toBe(a);
    expect(second.registered).toEqual(ALL);
  });
});
