/**
 * Turn-end status — `turn.completed` resultType handling. Successful turns are
 * SILENT (the old "✓ completed · cache …" agent_message_chunk persisted as a
 * timeline message after every turn — pure noise); only non-success resultTypes
 * surface as one warning-flavored line. Covers the full path: EventTranslator
 * extracts the fields onto a TurnInfo internal event, dispatchEvent renders it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as acp from "@agentclientprotocol/sdk";

import { dispatchEvent } from "../src/handlers/dispatch.js";
import { ZcodeAcpServer } from "../src/server.js";
import { EventTranslator } from "../src/translators/event-translator.js";
import type { InternalEvent } from "../src/translators/types.js";

const SID = "sess-turninfo";

// Pin the language: line text is locale-dependent.
beforeEach(() => {
  vi.stubEnv("ZCODE_ACP_LANG", "en");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Mock AgentContext that records notify calls. */
function mockContext(): { cx: acp.AgentContext; sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  const cx = {
    notify(_method: string, params: { update: unknown }) {
      sent.push(params.update as Record<string, unknown>);
      return Promise.resolve();
    },
  } as unknown as acp.AgentContext;
  return { cx, sent };
}

function textOf(u: Record<string, unknown>): string {
  return ((u as { content?: { text?: string } }).content ?? {}).text ?? "";
}

describe("dispatchEvent TurnInfo rendering", () => {
  it("success + full cacheStats stays silent — no timeline message", async () => {
    const { cx, sent } = mockContext();
    await dispatchEvent(
      new ZcodeAcpServer(),
      cx,
      SID,
      {
        kind: "TurnInfo",
        resultType: "success",
        cacheStats: {
          totalMessages: 45,
          cachedMessages: 42,
          lastCacheHit: true,
          cacheReadTokens: 12300,
        },
      },
      "chunk-1",
    );
    expect(sent).toHaveLength(0);
  });

  it("success + cacheStats without cacheReadTokens stays silent too", async () => {
    const { cx, sent } = mockContext();
    await dispatchEvent(
      new ZcodeAcpServer(),
      cx,
      SID,
      {
        kind: "TurnInfo",
        resultType: "success",
        cacheStats: { totalMessages: 10, cachedMessages: 4, lastCacheHit: false },
      },
      "chunk-2",
    );
    expect(sent).toHaveLength(0);
  });

  it("success without cacheStats stays silent (no bare completion line)", async () => {
    const { cx, sent } = mockContext();
    await dispatchEvent(
      new ZcodeAcpServer(),
      cx,
      SID,
      { kind: "TurnInfo", resultType: "success" },
      "chunk-3",
    );
    expect(sent).toHaveLength(0);
  });

  it("non-success resultType is named verbatim in a warning-flavored line", async () => {
    const { cx, sent } = mockContext();
    await dispatchEvent(
      new ZcodeAcpServer(),
      cx,
      SID,
      { kind: "TurnInfo", resultType: "error_max_budget" },
      "chunk-4",
    );
    expect(sent).toHaveLength(1);
    const u = sent[0]!;
    expect(u["sessionUpdate"]).toBe("agent_message_chunk");
    expect(textOf(u)).toBe("⚠ stopped early: error_max_budget");
    // Distinct messageId so the line stays a separate message from the reply.
    expect(u["messageId"]).toBe("turninfo_chunk-4");
  });

  it("cancelled resultType surfaces as stopped early too", async () => {
    const { cx, sent } = mockContext();
    await dispatchEvent(
      new ZcodeAcpServer(),
      cx,
      SID,
      { kind: "TurnInfo", resultType: "cancelled" },
      "chunk-5",
    );
    expect(textOf(sent[0]!)).toBe("⚠ stopped early: cancelled");
  });
});

describe("translate → dispatch end-to-end", () => {
  it("emits only the reply text — no status line after a successful turn", async () => {
    const { cx, sent } = mockContext();
    const server = new ZcodeAcpServer();
    const t = new EventTranslator();
    const events: InternalEvent[] = [
      ...t.translate({
        type: "model.streaming",
        payload: { kind: "text_delta", delta: "reply body" },
      }),
      ...t.translate({
        type: "turn.completed",
        payload: {
          resultType: "success",
          tokenCount: 5,
          usage: { totalTokens: 5, contextWindow: 200000 },
          cacheStats: {
            totalMessages: 45,
            cachedMessages: 42,
            lastCacheHit: true,
            cacheReadTokens: 12300,
          },
        },
      }),
    ];
    // Same funnel as the turn loop (session.ts dispatches every translated
    // internal event through dispatchEvent with the prompt's chunkMsgId).
    for (const iev of events) {
      await dispatchEvent(server, cx, SID, iev, "chunk-e2e");
    }
    // The reply text streams through untouched; the turn line is gone. No
    // usage_update here either: turn.completed's usage is cumulative
    // consumption, never the context meter (#228) — occupancy comes from the
    // reconciliation diff instead.
    expect(sent).toHaveLength(1); // agent text only
    expect(sent[0]!["sessionUpdate"]).toBe("agent_message_chunk");
    expect(textOf(sent[0]!)).toBe("reply body");
  });
});
