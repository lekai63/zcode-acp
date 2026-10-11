/**
 * Native guide-steer (`_zcode/guide`, handlers/guide.ts): a mid-turn message
 * becomes a v4 `sendText {requestedDelivery:"guide"}` on the running turn
 * instead of a preempting second prompt. The prompt that owns the turn stays
 * open until every guide reached the model — inline (`turn.steerDrained`), or
 * through a follow-up turn when the backend queued it — and guides that never
 * got there are removed from the session queue when the prompt is cancelled.
 */

import type * as acp from "@agentclientprotocol/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ZcodeBackend } from "../src/backend/client.js";
import type { ZcodeEvent } from "../src/backend/types.js";
import "../src/handlers/slash.js";
import { guide } from "../src/handlers/guide.js";
import { cancel, prompt } from "../src/handlers/session.js";
import { ZcodeAcpServer } from "../src/server.js";
import { EventTranslator } from "../src/translators/event-translator.js";

vi.mock("../src/tasks-index.js", () => ({
  upsertSessionTask: async () => true,
  updateSessionTitle: async () => true,
}));

interface Command {
  commandId: string;
  type: string;
  payload: Record<string, unknown>;
  baseRevision?: number;
}

/** Scripted backend: every v4/command is recorded and answered by `onCommand`. */
function guideBackend(onCommand: (cmd: Command) => Record<string, unknown>) {
  const listeners = new Set<{ handleEvent: (event: ZcodeEvent) => void }>();
  const commands: Command[] = [];
  let seq = 10;
  const emit = (type: string, payload: Record<string, unknown> = {}) => {
    const event = { sessionId: "zs_g", seq: seq++, type, payload } as ZcodeEvent;
    for (const listener of listeners) listener.handleEvent(event);
  };
  const backend = {
    isDead: false,
    request: async (_id: number, method: string, params?: Record<string, unknown>) => {
      switch (method) {
        case "workspace/updateProviderRegistry":
        case "session/resume":
          return { result: {} };
        case "session/subscribe":
          return { result: { eventSeq: 1 } };
        case "session/messages":
          return { result: { messages: [] } };
        case "session/read":
          return { result: { projection: { status: "running" }, settings: {} } };
        case "session/subagents":
          return { error: { code: -32601, message: "method not found" } };
        case "session/send":
          emit("turn.started", { inputId: "prompt-1" });
          return { result: { accepted: true } };
        case "v4/command": {
          const cmd = params as unknown as Command;
          commands.push(cmd);
          return { result: onCommand(cmd) };
        }
        default:
          return { error: { message: `unhandled ${method}` } };
      }
    },
    send: vi.fn(),
    pollServerRequests: () => [],
    registerEventListener: (_sid: string, listener: { handleEvent: (e: ZcodeEvent) => void }) =>
      listeners.add(listener),
    unregisterEventListener: (_sid: string, listener: { handleEvent: (e: ZcodeEvent) => void }) =>
      listeners.delete(listener),
  } as unknown as ZcodeBackend;
  return { backend, emit, commands };
}

function setup(backend: ZcodeBackend): ZcodeAcpServer {
  const server = new ZcodeAcpServer();
  server.backend = backend;
  server.registerSession("sess_g", "zs_g");
  server.markBackendLoaded("sess_g");
  return server;
}

const params = {
  sessionId: "sess_g",
  prompt: [{ type: "text", text: "do the task" }],
} as acp.PromptRequest;

const cx = {
  notify: vi.fn().mockResolvedValue(undefined),
  request: vi.fn().mockResolvedValue({}),
} as unknown as acp.AgentContext;

const guideParams = (text: string) => ({
  sessionId: "sess_g",
  prompt: [{ type: "text", text }] as acp.ContentBlock[],
});

/** agent_message_chunk texts dispatched to the client, in order. */
function chunks(): string[] {
  return vi
    .mocked(cx.notify)
    .mock.calls.map(([, payload]) => {
      const update = (
        payload as { update?: { sessionUpdate?: string; content?: { text?: string } } }
      ).update;
      return update?.sessionUpdate === "agent_message_chunk" ? (update.content?.text ?? "") : "";
    })
    .filter((text) => text.length > 0);
}

const accepted = (delivery = "queue") => ({
  status: "accepted",
  revisionAtDecision: 3,
  result: { type: "inputAccepted", delivery },
});

async function untilGuidable(server: ZcodeAcpServer) {
  for (let i = 0; i < 200; i++) {
    if ([...server.pendingTurns.values()].some((t) => t.guideReady)) return;
    await vi.advanceTimersByTimeAsync(10);
  }
  throw new Error("turn never became guidable");
}

describe("_zcode/guide", () => {
  beforeEach(() => {
    vi.stubEnv("ZCODE_ACP_LANG", "en");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("refuses without a running turn, and for non-text or slash input", async () => {
    const control = guideBackend(() => accepted());
    const server = setup(control.backend);
    await expect(guide(server, guideParams("hi"))).resolves.toEqual({
      outcome: "unavailable",
      reason: "no_active_turn",
    });
    await expect(
      guide(server, {
        sessionId: "sess_g",
        prompt: [{ type: "image", data: "", mimeType: "image/png" }] as acp.ContentBlock[],
      }),
    ).resolves.toMatchObject({ reason: "unsupported_content" });
    await expect(guide(server, guideParams("/compact"))).resolves.toMatchObject({
      reason: "slash_command",
    });
    expect(control.commands).toEqual([]);
  });

  it("guides the running turn inline and ends the prompt after the steered reply", async () => {
    const control = guideBackend(() => accepted());
    const server = setup(control.backend);
    const turn = prompt(server, params, cx, 1);
    await untilGuidable(server);

    const result = await guide(server, guideParams("also check the tests"));
    expect(result).toMatchObject({ outcome: "guided", delivery: "queue" });
    const sendText = control.commands[0];
    expect(sendText).toMatchObject({
      type: "sendText",
      payload: {
        text: "also check the tests",
        requestedDelivery: "guide",
        heldQueueDisposition: "keepQueueAndSend",
      },
    });

    control.emit("turn.steerQueued", {
      inputId: sendText.commandId,
      queryId: sendText.commandId,
      pendingInputId: "q1",
      delivery: "guide",
    });
    control.emit("turn.steerDrained", { pendingInputIds: ["q1"], queryIds: [sendText.commandId] });
    control.emit("model.streaming", {
      kind: "text_delta",
      delta: "checked the tests",
      assistantMessageId: "m2",
    });
    control.emit("turn.completed", { resultType: "success" });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(turn).resolves.toEqual({ stopReason: "end_turn" });
    expect(chunks()).toContain("checked the tests");
    expect(control.commands.map((c) => c.type)).toEqual(["sendText"]);
  });

  it("keeps the prompt open for a queued guide and resumes the queue for its turn", async () => {
    let stale = true;
    const control = guideBackend((cmd) => {
      if (cmd.type === "setAutoDrain" && stale) {
        stale = false;
        return { status: "stale", reasonCode: "proto.staleRevision", revisionAtDecision: 7 };
      }
      return accepted();
    });
    const server = setup(control.backend);
    const turn = prompt(server, params, cx, 2);
    await untilGuidable(server);
    const result = await guide(server, guideParams("one more thing"));
    expect(result.outcome).toBe("guided");
    const inputId = control.commands[0].commandId;

    // Queued, but the turn ends before a model-step boundary consumed it.
    control.emit("turn.steerQueued", { inputId, pendingInputId: "q9", delivery: "queue" });
    control.emit("model.streaming", {
      kind: "text_delta",
      delta: "done",
      assistantMessageId: "m1",
    });
    control.emit("turn.completed", { resultType: "success" });
    control.emit("state.updated", { reason: "prompt_completed" });
    let settled = false;
    void turn.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(settled).toBe(false);

    // The bridge resumed the queue (CAS: stale → retried at the fresh revision).
    const resumes = control.commands.filter((c) => c.type === "setAutoDrain");
    expect(resumes.map((c) => c.baseRevision)).toEqual([3, 7]);
    expect(resumes[1].payload).toEqual({ autoDrain: true });

    control.emit("turn.started", { inputId });
    control.emit("model.streaming", {
      kind: "text_delta",
      delta: "follow-up reply",
      assistantMessageId: "m3",
    });
    control.emit("turn.completed", { resultType: "success" });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(turn).resolves.toEqual({ stopReason: "end_turn" });
    expect(chunks()).toContain("follow-up reply");
  });

  it("chains the turn a guide started on its own (idle backend, startNow)", async () => {
    const control = guideBackend(() => accepted("startNow"));
    const server = setup(control.backend);
    const turn = prompt(server, params, cx, 3);
    await untilGuidable(server);
    await guide(server, guideParams("next"));
    const inputId = control.commands[0].commandId;

    control.emit("turn.completed", { resultType: "success" });
    control.emit("turn.started", { inputId });
    control.emit("model.streaming", {
      kind: "text_delta",
      delta: "own turn",
      assistantMessageId: "m4",
    });
    control.emit("turn.completed", { resultType: "success" });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(turn).resolves.toEqual({ stopReason: "end_turn" });
    expect(chunks()).toContain("own turn");
    // Nothing to resume: the guide was never queued.
    expect(control.commands.map((c) => c.type)).toEqual(["sendText"]);
  });

  it("refuses a guide once the prompt has ended", async () => {
    const control = guideBackend(() => accepted());
    const server = setup(control.backend);
    const turn = prompt(server, params, cx, 4);
    await untilGuidable(server);
    control.emit("turn.completed", { resultType: "success" });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(turn).resolves.toEqual({ stopReason: "end_turn" });
    await expect(guide(server, guideParams("late"))).resolves.toMatchObject({
      reason: "no_active_turn",
    });
  });

  it("returns the guide as unavailable when the backend rejects it", async () => {
    const control = guideBackend(() => ({
      status: "rejected",
      reasonCode: "fault.command.inputRejected",
      revisionAtDecision: 1,
    }));
    const server = setup(control.backend);
    const turn = prompt(server, params, cx, 5);
    await untilGuidable(server);
    await expect(guide(server, guideParams("x"))).resolves.toEqual({
      outcome: "unavailable",
      reason: "rejected: fault.command.inputRejected",
    });
    // A rejected guide does not hold the prompt open.
    control.emit("turn.completed", { resultType: "success" });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(turn).resolves.toEqual({ stopReason: "end_turn" });
  });

  it("removes an undelivered guide from the queue when the prompt is cancelled", async () => {
    const control = guideBackend(() => accepted());
    const server = setup(control.backend);
    const turn = prompt(server, params, cx, 6);
    await untilGuidable(server);
    await guide(server, guideParams("never mind"));
    const inputId = control.commands[0].commandId;
    control.emit("turn.steerQueued", { inputId, pendingInputId: "q5", delivery: "guide" });
    await vi.advanceTimersByTimeAsync(600);

    await cancel(server, { sessionId: "sess_g" });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(turn).resolves.toEqual({ stopReason: "cancelled" });
    const deletes = control.commands.filter((c) => c.type === "deleteQueueItem");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].payload).toEqual({ queueItemId: "q5" });
  });

  it("tells the user when a queued guide never starts", async () => {
    const control = guideBackend(() => accepted());
    const server = setup(control.backend);
    const turn = prompt(server, params, cx, 7);
    await untilGuidable(server);
    await guide(server, guideParams("lost"));
    const inputId = control.commands[0].commandId;
    control.emit("turn.steerQueued", { inputId, pendingInputId: "q7", delivery: "queue" });
    control.emit("turn.completed", { resultType: "success" });
    await vi.advanceTimersByTimeAsync(50_000);
    await expect(turn).resolves.toEqual({ stopReason: "end_turn" });
    expect(chunks()).toContain("[The guidance message never reached the model; please resend it.]");
    expect(control.commands.some((c) => c.type === "deleteQueueItem")).toBe(true);
  });
});

describe("EventTranslator.ignoreTerminalBroadcasts", () => {
  it("skips the previous turn's prompt_completed, then records its own", () => {
    const t = new EventTranslator();
    t.ignoreTerminalBroadcasts = 1;
    t.translate({ type: "turn.started", payload: {} });
    t.translate({ type: "state.updated", payload: { reason: "prompt_completed" } });
    expect(t.sawPromptCompleted).toBe(false);
    t.translate({ type: "state.updated", payload: { reason: "prompt_completed" } });
    expect(t.sawPromptCompleted).toBe(true);
  });
});
