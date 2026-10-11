/**
 * Template providers: create / key / delete in provider_config.json, and the
 * dropdown resolving template-linked rules.
 *
 * The desktop app's "add provider" writes a rule that only REFERENCES a
 * bundled template (`templateId`); endpoint and models are resolved from the
 * table at read time (packages/provider/src/config-service.ts
 * `createPersonalProvider`). These tests lock the same on-disk shape and the
 * dropdown's resolution of it.
 *
 * Real files in a temp data root: ZCODE_HOME for the config files, a fixture
 * bundled table via ZCODE_BUILTIN_PROVIDER_CONFIG_FILE, and ZCODE_BIN pointed
 * at a missing entry so the real desktop bundle's table is never picked up.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const home = mkdtempSync(path.join(tmpdir(), "provider-templates-"));
const table = path.join(home, "zcode-builtin.json");
writeFileSync(
  table,
  JSON.stringify({
    config: {
      providerConfigRules: {
        providerRules: [
          {
            providerId: "account:bigmodel-individual-coding-plan",
            providerName: "BigModel Individual Coding Plan",
          },
        ],
        templateRules: [
          {
            templateId: "bigmodel-api",
            templateNameMap: { "zh-CN": "BigModel Coding Plan", "en-US": "BigModel Coding Plan" },
            config: {
              access: {
                type: "zhipu-coding-plan-api-key",
                apiKeyManagementUrl: "https://bigmodel.cn/x",
              },
              api: {
                type: "anthropic-messages",
                baseUrl: "https://open.bigmodel.cn/api/anthropic",
              },
              builtinModelIds: ["GLM-5.3", "GLM-5.3-Flash"],
            },
          },
          {
            templateId: "moonshot-kimi",
            templateNameMap: { "en-US": "Kimi" },
            config: {
              access: { type: "api-key" },
              api: { type: "anthropic-messages", baseUrl: "https://api.moonshot.cn/anthropic" },
              builtinModelIds: ["kimi-k3"],
            },
          },
        ],
      },
    },
  }),
);
vi.stubEnv("ZCODE_HOME", home);
vi.stubEnv("ZCODE_BIN", path.join(home, "missing", "zcode.cjs"));
vi.stubEnv("ZCODE_BUILTIN_PROVIDER_CONFIG_FILE", table);
vi.stubEnv("ZCODE_PROVIDER", "");

const {
  createProviderFromTemplate,
  deleteProvider,
  listProviderTemplates,
  readProviderConfig,
  setProviderApiKey,
  upsertModel,
} = await import("../src/settings/provider-config.js");
const { loadAllModels } = await import("../src/config/options.js");
const { zcodePersonalProviderPath } = await import("../src/utils.js");

beforeEach(() => {
  mkdirSync(path.join(home, "v2"), { recursive: true });
  writeFileSync(zcodePersonalProviderPath(), JSON.stringify({ schemaVersion: 1, config: {} }));
  writeFileSync(path.join(home, "v2", "config.json"), JSON.stringify({ provider: {} }));
});

describe("listProviderTemplates", () => {
  it("reads the bundled table's templates", () => {
    expect(listProviderTemplates(table)).toEqual([
      {
        templateId: "bigmodel-api",
        name: "BigModel Coding Plan",
        nameZh: "BigModel Coding Plan",
        accessType: "zhipu-coding-plan-api-key",
        apiKeyManagementUrl: "https://bigmodel.cn/x",
        apiType: "anthropic-messages",
        baseUrl: "https://open.bigmodel.cn/api/anthropic",
        modelIds: ["GLM-5.3", "GLM-5.3-Flash"],
      },
      {
        templateId: "moonshot-kimi",
        name: "Kimi",
        accessType: "api-key",
        apiType: "anthropic-messages",
        baseUrl: "https://api.moonshot.cn/anthropic",
        modelIds: ["kimi-k3"],
      },
    ]);
  });
});

describe("createProviderFromTemplate", () => {
  it("writes the app's template-linked rule with the template's access type", async () => {
    const { providerId } = await createProviderFromTemplate(
      { templateId: "bigmodel-api", apiKey: " k1 " },
      table,
    );
    expect(providerId).toBe("bigmodel-api");
    const doc = JSON.parse(readFileSync(zcodePersonalProviderPath(), "utf8"));
    expect(doc.config.providerConfigRules.providerRules).toEqual([
      {
        providerId: "bigmodel-api",
        templateId: "bigmodel-api",
        providerName: "BigModel Coding Plan",
        config: {
          group: "standard-personal",
          access: { type: "zhipu-coding-plan-api-key", apiKey: "k1" },
          personalModelIds: [],
          modelOrder: [],
        },
      },
    ]);
    expect(doc.config.providerOrder).toEqual(["bigmodel-api"]);
  });

  it("de-duplicates the id with -N and the name with ' N', appending to the order", async () => {
    await createProviderFromTemplate({ templateId: "moonshot-kimi", apiKey: "a" }, table);
    const second = await createProviderFromTemplate(
      { templateId: "moonshot-kimi", apiKey: "b" },
      table,
    );
    expect(second.providerId).toBe("moonshot-kimi-2");
    const rules = (await readProviderConfig()).config.providerConfigRules.providerRules;
    expect(rules.map((r) => r.providerName)).toEqual(["Kimi", "Kimi 2"]);
    expect((await readProviderConfig()).config.providerOrder).toEqual([
      "moonshot-kimi",
      "moonshot-kimi-2",
    ]);
  });

  it("rejects an unknown template and an empty key", async () => {
    await expect(
      createProviderFromTemplate({ templateId: "nope", apiKey: "k" }, table),
    ).rejects.toThrow(/does not exist/);
    await expect(
      createProviderFromTemplate({ templateId: "moonshot-kimi", apiKey: "  " }, table),
    ).rejects.toThrow(/API key is required/);
  });
});

describe("setProviderApiKey / deleteProvider", () => {
  it("replaces the key and keeps the template's access type", async () => {
    await createProviderFromTemplate({ templateId: "bigmodel-api", apiKey: "old" }, table);
    await setProviderApiKey("bigmodel-api", "new", table);
    const rule = (await readProviderConfig()).config.providerConfigRules.providerRules[0]!;
    expect(rule.config?.access).toEqual({ type: "zhipu-coding-plan-api-key", apiKey: "new" });
  });

  it("deletes the rule, its model rules and its order entry", async () => {
    await createProviderFromTemplate({ templateId: "moonshot-kimi", apiKey: "a" }, table);
    await createProviderFromTemplate({ templateId: "bigmodel-api", apiKey: "b" }, table);
    await upsertModel("moonshot-kimi", "kimi-extra", {});
    await deleteProvider("moonshot-kimi");
    const doc = await readProviderConfig();
    expect(doc.config.providerConfigRules.providerRules.map((r) => r.providerId)).toEqual([
      "bigmodel-api",
    ]);
    expect(doc.config.modelConfigRules.providerModelRules).toEqual([]);
    expect(doc.config.providerOrder).toEqual(["bigmodel-api"]);
    await expect(deleteProvider("moonshot-kimi")).rejects.toThrow(/has no rule/);
    await expect(deleteProvider("account:bigmodel-individual-coding-plan")).rejects.toThrow(
      /account-managed/,
    );
  });
});

describe("loadAllModels with template-linked providers", () => {
  it("lists the template's models plus the rule's own, minus disabled ones", async () => {
    await createProviderFromTemplate({ templateId: "bigmodel-api", apiKey: "k" }, table);
    await upsertModel("bigmodel-api", "GLM-5.3-Flash", { enabled: false });
    await upsertModel("bigmodel-api", "GLM-extra", {});
    const models = loadAllModels().filter((m) => m.providerId === "bigmodel-api");
    expect(models.map((m) => m.modelId).sort()).toEqual(["GLM-5.3", "GLM-extra"]);
    expect(models[0]!.providerName).toBe("BigModel Coding Plan");
  });

  it("skips a keyless template provider and a disabled one", async () => {
    writeFileSync(
      zcodePersonalProviderPath(),
      JSON.stringify({
        schemaVersion: 1,
        config: {
          providerConfigRules: {
            providerRules: [
              {
                providerId: "moonshot-kimi",
                templateId: "moonshot-kimi",
                config: { group: "standard-personal" },
              },
              {
                providerId: "bigmodel-api",
                templateId: "bigmodel-api",
                enabled: false,
                config: {
                  group: "standard-personal",
                  access: { type: "zhipu-coding-plan-api-key", apiKey: "k" },
                },
              },
            ],
          },
          modelConfigRules: { providerModelRules: [], manualProviderModelRules: [] },
        },
      }),
    );
    expect(loadAllModels().filter((m) => m.providerId !== "builtin:bigmodel-coding-plan")).toEqual(
      [],
    );
  });
});
