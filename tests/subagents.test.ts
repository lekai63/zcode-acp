/**
 * SubagentTracker unit tests.
 *
 * Drives handleEvent() with the shapes the real app-server puts on the wire:
 *   - `tool.updated` mirrored from a CHILD session (source:"subagent",
 *     toolCallId "tool_subagent_<agentId>_<childToolCallId>",
 *     core/src/subagent/tool-event-mirror.ts)
 *   - the `session/subagents` directory result
 *     (packages/shared/src/zcode-protocol/index.ts zcodeSessionSubagentsResultSchema)
 *
 * and asserts the `_zcode/subagent` vendor notifications pushed back through
 * the server. No real backend or ACP client: both server methods are stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SUBAGENT_NOTIFICATION_METHOD,
  SubagentTracker,
  mapSubagentStatus,
  parseSubagentResultMeta,
  type SubagentNotificationPayload,
} from "../src/handlers/subagents.js";
import { EventTranslator } from "../src/translators/event-translator.js";
import type { ZcodeAcpServer } from "../src/server.js";
import type { ZcodeEvent } from "../src/backend/types.js";

interface FakeServer {
  calls: Array<{ zcodeSid: string; method: string; params: SubagentNotificationPayload }>;
  backendResult: Record<string, unknown> | { error: { message: string } };
  requestCalls: Array<{ method: string; params: Record<string, unknown> }>;
}

type TestServer = FakeServer &
  Pick<ZcodeAcpServer, "notifyVendorByZcodeSid" | "currentBackend" | "nextId">;

function makeServer(): TestServer {
  const calls: TestServer["calls"] = [];
  const requestCalls: TestServer["requestCalls"] = [];
  const state: FakeServer = { calls, backendResult: {}, requestCalls };
  const server = {
    ...state,
    async notifyVendorByZcodeSid(
      zcodeSid: string,
      method: string,
      params: Record<string, unknown>,
    ): Promise<boolean> {
      calls.push({
        zcodeSid,
        method,
        params: params as unknown as SubagentNotificationPayload,
      });
      return true;
    },
    currentBackend() {
      return {
        isDead: false,
        async request(_id: number, method: string, params: Record<string, unknown>) {
          requestCalls.push({ method, params });
          const result = (server as unknown as FakeServer).backendResult;
          return "error" in result ? { error: result.error } : { result };
        },
      };
    },
    nextId: () => 1,
  };
  return server as unknown as TestServer;
}

function zcodeEvent(
  type: string,
  payload: Record<string, unknown>,
  extra: Partial<ZcodeEvent> = {},
): ZcodeEvent {
  return {
    sessionId: "sess_parent",
    seq: 0,
    type: type as ZcodeEvent["type"],
    payload,
    ...extra,
  };
}

/** A mirrored child tool event, as the parent stream carries it. */
function mirrorEvent(
  kind: string,
  overrides: Record<string, unknown> = {},
): ZcodeEvent {
  const childToolCallId = (overrides["childToolCallId"] as string) ?? "call_child1";
  const agentId = (overrides["agentId"] as string) ?? "agent_a1";
  return zcodeEvent("tool.updated", {
    kind,
    toolCallId: `tool_subagent_${agentId}_${childToolCallId}`,
    childToolCallId,
    agentId,
    agentType: "Explore",
    childSessionId: `sess_subagent_${agentId}`,
    parentToolCallId: "call_dispatch",
    description: "search the repo",
    source: "subagent",
    toolName: "Read",
    input: { file_path: "src/index.ts" },
    result: { success: true, content: "ok" },
    ...overrides,
  });
}

/** The `session/subagents` directory payload. */
function directory(running: unknown[], ended: unknown[] = []): Record<string, unknown> {
  return {
    revision: 3,
    childSessionIds: [...running, ...ended].map(
      (item) => (item as Record<string, unknown>)["childSessionId"] as string,
    ),
    running,
    ended: { total: ended.length, items: ended },
  };
}

describe("mapSubagentStatus", () => {
  it("maps every ZCode status vocabulary onto the card status", () => {
    // v3 running bucket
    for (const value of ["running", "waiting", "blocked"]) {
      expect(mapSubagentStatus(value, "spawned")).toBe("running");
    }
    // v3 ended bucket + background runtime statuses
    for (const value of ["success", "completed"]) {
      expect(mapSubagentStatus(value, "stopped")).toBe("completed");
    }
    for (const value of ["failed", "lost", "timed_out", "spawn_error", "error"]) {
      expect(mapSubagentStatus(value, "stopped")).toBe("failed");
    }
    for (const value of ["cancelled", "canceled", "stopped", "aborted"]) {
      expect(mapSubagentStatus(value, "stopped")).toBe("canceled");
    }
    // Absent status: a spawn is running, a stop ended.
    expect(mapSubagentStatus(undefined, "spawned")).toBe("running");
    expect(mapSubagentStatus(undefined, "stopped")).toBe("completed");
  });
});

describe("parseSubagentResultMeta", () => {
  it("parses the agentId + <usage> markers the Agent tool result carries", () => {
    const meta = parseSubagentResultMeta({
      content:
        "done\nagentId: agent_abc-123 (use SendMessage with to: 'agent_abc-123')\n" +
        "<usage>subagent_tokens: 40904\ntool_uses: 7\nduration_ms: 10559</usage>",
    });
    expect(meta).toEqual({
      agentId: "agent_abc-123",
      tokens: 40904,
      toolUses: 7,
      durationMs: 10559,
    });
  });

  it("parses content-block and structured result shapes", () => {
    // Content blocks (the shape the event stream uses for some builds).
    expect(
      parseSubagentResultMeta({
        success: true,
        content: [
          {
            type: "text",
            text:
              "done\nagentId: agent_blk-1 (use SendMessage with to: 'agent_blk-1')\n" +
              "<usage>subagent_tokens: 11\ntool_uses: 2\nduration_ms: 3</usage>",
          },
        ],
      }),
    ).toEqual({ agentId: "agent_blk-1", tokens: 11, toolUses: 2, durationMs: 3 });

    // Structured output with no markers at all.
    expect(
      parseSubagentResultMeta({
        status: "completed",
        agentId: "agent_struct-1",
        totalTokens: 42,
        totalToolUseCount: 5,
        totalDurationMs: 900,
      }),
    ).toEqual({ agentId: "agent_struct-1", tokens: 42, toolUses: 5, durationMs: 900 });
  });

  it("returns an empty object for non-subagent results", () => {
    expect(parseSubagentResultMeta({ success: true, content: "plain output" })).toEqual({});
    expect(parseSubagentResultMeta(undefined)).toEqual({});
  });
});

describe("SubagentTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns mirrored child tool events into one sub-agent card with identity + log", async () => {
    const server = makeServer();
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");

    tracker.handleEvent(mirrorEvent("scheduled"));
    await vi.advanceTimersByTimeAsync(1);

    expect(server.calls).toHaveLength(1);
    const { method, params } = server.calls[0]!;
    expect(method).toBe(SUBAGENT_NOTIFICATION_METHOD);
    expect(params.sessionId).toBe("sess_parent");
    expect(params.agentId).toBe("agent_a1");
    expect(params.agentType).toBe("Explore");
    expect(params.childSessionId).toBe("sess_subagent_agent_a1");
    // Keyed by the dispatch call id so the client merges it with the existing
    // Agent/Task tool card instead of spawning a second row.
    expect(params.parentToolCallId).toBe("call_dispatch");
    expect(params.status).toBe("running");
    expect(params.log).toEqual(["[Read] src/index.ts"]);
  });

  it("keeps one log line per child tool, upgraded with the outcome", async () => {
    const server = makeServer();
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");

    tracker.handleEvent(mirrorEvent("scheduled"));
    tracker.handleEvent(mirrorEvent("started"));
    tracker.handleEvent(mirrorEvent("result"));
    // A second call in the same child session.
    tracker.handleEvent(mirrorEvent("scheduled", { childToolCallId: "call_child2", toolName: "Bash", input: { command: "pnpm test" } }));
    tracker.handleEvent(mirrorEvent("result", { childToolCallId: "call_child2", toolName: "Bash", result: { success: false } }));
    await vi.advanceTimersByTimeAsync(1000);

    const last = server.calls.at(-1)!.params;
    // The terminal event REPLACES the call's start line (one call = one line,
    // keeping the position of its first sighting) and repeats its summary.
    expect(last.log).toEqual([
      "[Read] src/index.ts · done",
      "[Bash] pnpm test · failed",
    ]);
  });

  it("throttles bursts but still flushes the final state", async () => {
    const server = makeServer();
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");

    // The first emit is immediate (no prior emit), the rest coalesce.
    tracker.handleEvent(mirrorEvent("scheduled"));
    tracker.handleEvent(mirrorEvent("result"));
    await vi.advanceTimersByTimeAsync(10);
    expect(server.calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(600);
    expect(server.calls).toHaveLength(2);
    expect(server.calls.at(-1)!.params.log).toEqual(["[Read] src/index.ts · done"]);
    expect(server.calls.at(-1)!.params.revision).toBe(2);
  });

  it("reconciles against the session/subagents directory (running + ended)", async () => {
    const server = makeServer();
    server.backendResult = directory(
      [
        {
          childSessionId: "sess_subagent_agent_a1",
          agentId: "agent_a1",
          toolCallId: "call_dispatch",
          subagentType: "Explore",
          title: "search the repo",
          startedAt: 100,
          status: "running",
        },
      ],
      [
        {
          childSessionId: "sess_subagent_agent_b2",
          agentId: "agent_b2",
          toolCallId: "call_dispatch_b",
          subagentType: "general-purpose",
          title: "refactor module",
          summary: "12 files touched",
          startedAt: 50,
          endedAt: 200,
          status: "success",
        },
      ],
    );
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");

    await tracker.refreshFromProtocol();
    await vi.advanceTimersByTimeAsync(10);

    expect(server.requestCalls[0]!.method).toBe("session/subagents");
    expect(server.requestCalls[0]!.params).toEqual({
      sessionId: "sess_parent",
      endedLimit: 20,
    });

    const payloads = server.calls.map((call) => call.params);
    const ended = payloads.find((p) => p.agentId === "agent_b2");
    expect(ended).toBeDefined();
    // v3 ended vocabulary `success` → card `completed`, with title + summary.
    expect(ended!.status).toBe("completed");
    expect(ended!.agentType).toBe("general-purpose");
    expect(ended!.title).toBe("refactor module");
    expect(ended!.summary).toBe("12 files touched");
    expect(ended!.endedAt).toBe(200);
    expect(ended!.log.at(-1)).toBe("stopped · completed");
  });

  it("promotes a mirrored agent to its directory status exactly once", async () => {
    const server = makeServer();
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");
    tracker.handleEvent(mirrorEvent("scheduled"));
    await vi.advanceTimersByTimeAsync(10);

    server.backendResult = directory([], [
      {
        childSessionId: "sess_subagent_agent_a1",
        agentId: "agent_a1",
        toolCallId: "call_dispatch",
        subagentType: "Explore",
        title: "search the repo",
        startedAt: 100,
        endedAt: 300,
        status: "cancelled",
      },
    ]);
    await tracker.refreshFromProtocol();
    await tracker.refreshFromProtocol();
    await vi.advanceTimersByTimeAsync(10);

    const finals = server.calls.filter((call) => call.params.status === "canceled");
    expect(finals).toHaveLength(1);
    const all = server.calls.at(-1)!.params;
    expect(all.status).toBe("canceled");
    // Identity from the mirror is preserved when the directory entry lands.
    expect(all.parentToolCallId).toBe("call_dispatch");
    expect(all.agentType).toBe("Explore");
  });

  it("ignores a directory refresh error without throwing", async () => {
    const server = makeServer();
    server.backendResult = { error: { message: "Session is not active: sess_parent" } };
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");
    await expect(tracker.refreshFromProtocol()).resolves.toBeUndefined();
    expect(server.calls).toHaveLength(0);
  });

  it("binds the dispatch callId + usage markers from the Agent tool result", async () => {
    const server = makeServer();
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");

    // `scheduled` carries the tool name; the terminal event omits it.
    tracker.handleEvent(
      zcodeEvent("tool.updated", {
        kind: "scheduled",
        toolCallId: "call_dispatch",
        toolName: "Agent",
        input: { description: "search the repo", subagent_type: "Explore" },
      }),
    );
    tracker.handleEvent(
      zcodeEvent("tool.updated", {
        kind: "result",
        toolCallId: "call_dispatch",
        result: {
          content: [
            {
              type: "text",
              text:
                "ok\nagentId: agent_a1 (use SendMessage with to: 'agent_a1')\n" +
                "<usage>subagent_tokens: 40904\ntool_uses: 7\nduration_ms: 10559</usage>",
            },
          ],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(10);

    const payload = server.calls.at(-1)!.params;
    expect(payload.agentId).toBe("agent_a1");
    expect(payload.parentToolCallId).toBe("call_dispatch");
    expect(payload.tokens).toBe(40904);
    expect(payload.toolUses).toBe(7);
    expect(payload.durationMs).toBe(10559);
  });

  it("handles internal subagent_* lifecycle events when a backend emits them", async () => {
    const server = makeServer();
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");

    tracker.handleEvent(
      zcodeEvent("subagent_spawned", {
        agentId: "agent_a1",
        agentType: "Explore",
        childSessionId: "sess_subagent_agent_a1",
        parentToolCallId: "call_dispatch",
        background: true,
      }),
    );
    await vi.advanceTimersByTimeAsync(10);
    expect(server.calls.at(-1)!.params.status).toBe("running");
    expect(server.calls.at(-1)!.params.background).toBe(true);

    tracker.handleEvent(
      zcodeEvent("subagent_stopped", {
        agentId: "agent_a1",
        childSessionId: "sess_subagent_agent_a1",
        status: "stopped",
        error: "user cancelled",
      }),
    );
    await vi.advanceTimersByTimeAsync(10);
    const final = server.calls.at(-1)!.params;
    expect(final.status).toBe("canceled");
    expect(final.log.at(-1)).toBe("stopped · canceled · user cancelled");
  });

  it("merges a running subagents patch from state.updated", async () => {
    const server = makeServer();
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");

    tracker.handleEvent(
      zcodeEvent("state.updated", {
        patch: {
          subagents: {
            revision: 1,
            childSessionIds: ["sess_subagent_agent_c3"],
            running: [
              {
                childSessionId: "sess_subagent_agent_c3",
                toolCallId: "call_c",
                subagentType: "Explore",
                title: "look around",
                status: "running",
              },
            ],
          },
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(10);

    const payload = server.calls.at(-1)!.params;
    expect(payload.agentId).toBe("sess_subagent_agent_c3");
    expect(payload.title).toBe("look around");
    expect(payload.parentToolCallId).toBe("call_c");
  });

  it("marks in-flight agents canceled on shutdown", async () => {
    const server = makeServer();
    const tracker = new SubagentTracker(server as unknown as ZcodeAcpServer, "sess_parent");
    tracker.handleEvent(mirrorEvent("scheduled"));
    await vi.advanceTimersByTimeAsync(10);

    await tracker.emitShutdownRecords();
    const payload = server.calls.at(-1)!.params;
    expect(payload.status).toBe("canceled");
    expect(payload.log.at(-1)).toBe("stopped · canceled · bridge shutdown");
  });
});

describe("EventTranslator sub-agent mirror guard", () => {
  it("does not render mirrored child tool events as parent tool cards", () => {
    const translator = new EventTranslator();
    const events = translator.translate(mirrorEvent("scheduled"));
    expect(events).toEqual([]);
    // The child call id must not be registered as a seen parent tool either.
    expect(translator.seenToolIds.size).toBe(0);
  });

  it("still renders the parent's own Agent dispatch card", () => {
    const translator = new EventTranslator();
    const events = translator.translate(
      zcodeEvent("tool.updated", {
        kind: "scheduled",
        toolCallId: "call_dispatch",
        toolName: "Agent",
        input: { description: "search", subagent_type: "Explore" },
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "ToolCallNew", callId: "call_dispatch", tool: "Agent" });
  });
});
