/**
 * The provider baseURL must not travel through `ZCODE_BASE_URL`.
 *
 * The ZCode CLI reads `ZCODE_BASE_URL`'s origin as the ZCode endpoint (serving
 * `/api/v1/agent/configs`, which carries the signing flag and the endpoint
 * routing map). Injecting the provider baseURL there makes the CLI query the
 * provider's host instead, so signing stays off and the routing map never
 * loads. `mergeEnvWithCreds` publishes the provider into the CLI config and
 * drops the config-derived `ZCODE_BASE_URL` instead.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZCODE_CREDS_PATH } from "../src/utils.js";

function plan(name: string, baseURL: string, apiKey: string, modelId: string) {
  return {
    name,
    kind: "anthropic",
    enabled: true,
    options: { apiKey, baseURL },
    models: { [modelId]: {} },
  };
}

const activeConfig = {
  provider: {
    "builtin:bigmodel-coding-plan": plan(
      "BigModel - Coding Plan",
      "https://open.bigmodel.cn/api/anthropic",
      "id.secret",
      "GLM-5.3",
    ),
  },
};

let credsConfig: unknown = activeConfig;
let existingCliConfig: string | null = null;
const written = new Map<string, string>();

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    readFileSync: (p: string, enc?: unknown) => {
      if (p === ZCODE_CREDS_PATH) return JSON.stringify(credsConfig);
      if (typeof p === "string" && p.endsWith(".zcode/cli/config.json")) {
        if (existingCliConfig === null) {
          throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        }
        return existingCliConfig;
      }
      return actual.readFileSync(p as never, enc as never);
    },
    writeFileSync: (p: string, data: string) => {
      written.set(p, data);
    },
    renameSync: (from: string, to: string) => {
      const data = written.get(from);
      if (data !== undefined) written.set(to, data);
    },
    mkdirSync: () => undefined,
  };
});

const { loadZcodeCredentials, mergeEnvWithCreds } = await import(
  "../src/backend/credentials.js"
);

const HOME = "/tmp/zcode-acp-test-home";
const CLI_CONFIG = `${HOME}/.zcode/cli/config.json`;

beforeEach(() => {
  vi.stubEnv("HOME", HOME);
  vi.stubEnv("ZCODE_BASE_URL", "");
  vi.stubEnv("ZCODE_MODEL", "");
  vi.stubEnv("ZCODE_PROVIDER", "");
  credsConfig = activeConfig;
  existingCliConfig = null;
  written.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mergeEnvWithCreds endpoint-origin fix", () => {
  it("drops the config-derived ZCODE_BASE_URL and keeps the model/key", () => {
    const merged = mergeEnvWithCreds(loadZcodeCredentials());

    expect(merged.ZCODE_BASE_URL).toBeUndefined();
    expect(merged.ZCODE_MODEL).toBe("GLM-5.3");
    expect(merged.ANTHROPIC_API_KEY).toBe("id.secret");
  });

  it("publishes the provider baseURL into the CLI config", () => {
    mergeEnvWithCreds(loadZcodeCredentials());

    const config = JSON.parse(written.get(CLI_CONFIG) ?? "{}");
    expect(config.provider["builtin:bigmodel-coding-plan"].options.baseURL).toBe(
      "https://open.bigmodel.cn/api/anthropic",
    );
    expect(config.model).toBe("builtin:bigmodel-coding-plan/GLM-5.3");
  });

  it("leaves an explicit ZCODE_BASE_URL override untouched", () => {
    vi.stubEnv("ZCODE_BASE_URL", "https://zcode.example");

    const merged = mergeEnvWithCreds(loadZcodeCredentials());

    expect(merged.ZCODE_BASE_URL).toBe("https://zcode.example");
  });

  it("preserves unrelated keys in an existing CLI config", () => {
    existingCliConfig = JSON.stringify({
      model: "other-provider/GLM-9",
      ui: { locale: "zh-CN" },
    });

    mergeEnvWithCreds(loadZcodeCredentials());

    const config = JSON.parse(written.get(CLI_CONFIG) ?? "{}");
    expect(config.ui.locale).toBe("zh-CN");
    expect(config.model).toBe("other-provider/GLM-9");
    expect(config.provider["builtin:bigmodel-coding-plan"]).toBeDefined();
  });
});
