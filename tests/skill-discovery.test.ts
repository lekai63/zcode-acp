/**
 * skill-discovery.ts tests — verifies that Skills are discovered from multiple
 * directories, disabled skills are excluded, descriptions are truncated, and
 * duplicate names are deduplicated.
 *
 * Uses the same node:fs mocking pattern as plugin-commands.test.ts.
 */

import { homedir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

// --- mock fs ---

const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: (p: string) => mockDirs.has(p) || mockFiles.has(p),
    readFileSync: ((p: string, ...args: unknown[]) => {
      if (mockFiles.has(p)) return mockFiles.get(p)!;
      return actual.readFileSync(p, ...(args as [unknown]));
    }) as typeof actual.readFileSync,
    readdirSync: (p: string) => {
      const entries: string[] = [];
      const prefix = p + "/";
      for (const key of mockDirs) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          if (!rest.includes("/")) entries.push(rest);
        }
      }
      for (const key of mockFiles.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          if (!rest.includes("/")) entries.push(rest);
        }
      }
      return entries;
    },
    statSync: (p: string) => {
      if (mockDirs.has(p)) return { isDirectory: () => true } as ReturnType<typeof actual.statSync>;
      return actual.statSync(p);
    },
  };
});

import { loadProjectSkillCommands, loadSkillCommands } from "../src/config/skill-discovery.js";

function resetMocks(): void {
  mockFiles.clear();
  mockDirs.clear();
}

const HOME = homedir();

/** Helper: set up a SKILL.md file with frontmatter. */
function setSkill(dir: string, name: string, description: string, extra = ""): void {
  mockDirs.add(dir);
  mockDirs.add(`${dir}/${name}`);
  mockFiles.set(
    `${dir}/${name}/SKILL.md`,
    `---\nname: ${name}\ndescription: ${description}${extra}\n---\n\n# ${name}\n`,
  );
}

afterEach(() => {
  resetMocks();
});

describe("loadSkillCommands", () => {
  it("returns empty when no skill directories exist", () => {
    resetMocks();
    expect(loadSkillCommands()).toEqual([]);
  });

  it("discovers skills from ~/.zcode/skills/", () => {
    resetMocks();
    setSkill(`${HOME}/.zcode/skills`, "arco-design", "Arco Design React UI library reference.");
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$arco-design");
    expect(skills[0]!.description).toContain("Arco Design");
  });

  it("discovers skills from ~/.agents/skills/", () => {
    resetMocks();
    setSkill(`${HOME}/.agents/skills`, "tdd", "Test-driven development skill.");
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$tdd");
  });

  it("discovers skills from both directories", () => {
    resetMocks();
    setSkill(`${HOME}/.zcode/skills`, "arco-design", "Arco Design reference.");
    setSkill(`${HOME}/.agents/skills`, "tdd", "Test-driven development.");
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(["$arco-design", "$tdd"]);
  });

  it("excludes skills disabled in config.json", () => {
    resetMocks();
    const skillDir = `${HOME}/.zcode/skills/my-skill`;
    mockDirs.add(`${HOME}/.zcode/skills`);
    mockDirs.add(skillDir);
    const skillMd = `${skillDir}/SKILL.md`;
    mockFiles.set(skillMd, `---\nname: my-skill\ndescription: A skill.\n---\n`);
    const resolved = path.resolve(skillMd);

    mockFiles.set(
      `${HOME}/.zcode/cli/config.json`,
      JSON.stringify({
        skills: {
          [resolved]: { enable: false },
        },
      }),
    );

    const skills = loadSkillCommands();
    expect(skills).toHaveLength(0);
  });

  it("includes skills that are not in config.json disable list", () => {
    resetMocks();
    setSkill(`${HOME}/.zcode/skills`, "enabled-skill", "An enabled skill.");
    // Config exists but doesn't mention this skill
    mockFiles.set(`${HOME}/.zcode/cli/config.json`, JSON.stringify({ skills: {} }));
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$enabled-skill");
  });

  it("excludes skills with user-invocable: false", () => {
    resetMocks();
    setSkill(
      `${HOME}/.zcode/skills`,
      "internal-only",
      "An internal skill.",
      "\nuser-invocable: false",
    );
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(0);
  });

  it("truncates long descriptions to 80 characters", () => {
    resetMocks();
    const longDesc = "A".repeat(120);
    setSkill(`${HOME}/.zcode/skills`, "verbose-skill", longDesc);
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.description.length).toBe(80);
    expect(skills[0]!.description.endsWith("…")).toBe(true);
  });

  it("does not truncate short descriptions", () => {
    resetMocks();
    setSkill(`${HOME}/.zcode/skills`, "short", "Short desc.");
    const skills = loadSkillCommands();
    expect(skills[0]!.description).toBe("Short desc.");
  });

  it("deduplicates by name (first occurrence wins)", () => {
    resetMocks();
    setSkill(`${HOME}/.zcode/skills`, "dup", "From .zcode (first).");
    setSkill(`${HOME}/.agents/skills`, "dup", "From .agents (second).");
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.description).toBe("From .zcode (first).");
  });

  it("discovers skills from enabled plugins", () => {
    resetMocks();
    const cacheDir = `${HOME}/.zcode/cli/plugins/cache`;
    mockFiles.set(
      `${HOME}/.zcode/cli/config.json`,
      JSON.stringify({
        plugins: {
          enabledPlugins: {
            "doc-skills@zcode-plugins-official": true,
            "disabled-plugin@zcode-plugins-official": false,
          },
        },
      }),
    );
    mockDirs.add(cacheDir);
    mockDirs.add(`${cacheDir}/zcode-plugins-official`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/doc-skills`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/doc-skills/1.0.0`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/doc-skills/1.0.0/skills`);
    setSkill(
      `${cacheDir}/zcode-plugins-official/doc-skills/1.0.0/skills`,
      "docx",
      "DOCX document creation skill.",
    );

    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$docx");
  });

  it("skips skills from disabled plugins", () => {
    resetMocks();
    const cacheDir = `${HOME}/.zcode/cli/plugins/cache`;
    mockFiles.set(
      `${HOME}/.zcode/cli/config.json`,
      JSON.stringify({
        plugins: {
          enabledPlugins: {
            "doc-skills@zcode-plugins-official": false,
          },
        },
      }),
    );
    mockDirs.add(cacheDir);
    mockDirs.add(`${cacheDir}/zcode-plugins-official`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/doc-skills`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/doc-skills/1.0.0`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/doc-skills/1.0.0/skills`);
    setSkill(`${cacheDir}/zcode-plugins-official/doc-skills/1.0.0/skills`, "docx", "DOCX skill.");

    const skills = loadSkillCommands();
    expect(skills).toHaveLength(0);
  });

  it("discovers skills from default-enabled official plugins without any config entry", () => {
    resetMocks();
    const cacheDir = `${HOME}/.zcode/cli/plugins/cache`;
    // NO config.json — the runtime scans the official cache with default
    // enablement, and so must the bridge (documents/pdf/zcode-guide/…).
    mockDirs.add(cacheDir);
    mockDirs.add(`${cacheDir}/zcode-plugins-official`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf/0.1.7`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf/0.1.7/skills`);
    setSkill(`${cacheDir}/zcode-plugins-official/pdf/0.1.7/skills`, "pdf", "PDF toolkit.");

    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$pdf");
  });

  it("keeps default-enabled official plugins off when explicitly disabled in config", () => {
    resetMocks();
    const cacheDir = `${HOME}/.zcode/cli/plugins/cache`;
    mockFiles.set(
      `${HOME}/.zcode/cli/config.json`,
      JSON.stringify({
        plugins: { enabledPlugins: { "pdf@zcode-plugins-official": false } },
      }),
    );
    mockDirs.add(cacheDir);
    mockDirs.add(`${cacheDir}/zcode-plugins-official`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf/0.1.7`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf/0.1.7/skills`);
    setSkill(`${cacheDir}/zcode-plugins-official/pdf/0.1.7/skills`, "pdf", "PDF toolkit.");

    expect(loadSkillCommands()).toHaveLength(0);
  });

  it("skips non-default official plugins unless explicitly enabled", () => {
    resetMocks();
    const cacheDir = `${HOME}/.zcode/cli/plugins/cache`;
    mockDirs.add(cacheDir);
    mockDirs.add(`${cacheDir}/zcode-plugins-official`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/android-emulator`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/android-emulator/0.1.0`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/android-emulator/0.1.0/skills`);
    setSkill(
      `${cacheDir}/zcode-plugins-official/android-emulator/0.1.0/skills`,
      "android",
      "Android automation.",
    );

    // Default-off without config…
    expect(loadSkillCommands()).toHaveLength(0);

    // …and on with an explicit true.
    mockFiles.set(
      `${HOME}/.zcode/cli/config.json`,
      JSON.stringify({
        plugins: { enabledPlugins: { "android-emulator@zcode-plugins-official": true } },
      }),
    );
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$android");
  });

  it("skips suppressed built-ins (uninstalled from the desktop)", () => {
    resetMocks();
    const cacheDir = `${HOME}/.zcode/cli/plugins/cache`;
    mockFiles.set(
      `${HOME}/.zcode/cli/config.json`,
      JSON.stringify({
        plugins: { suppressedBuiltins: ["zcode-guide@zcode-plugins-official"] },
      }),
    );
    mockDirs.add(cacheDir);
    mockDirs.add(`${cacheDir}/zcode-plugins-official`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/zcode-guide`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/zcode-guide/0.2.0`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/zcode-guide/0.2.0/skills`);
    setSkill(
      `${cacheDir}/zcode-plugins-official/zcode-guide/0.2.0/skills`,
      "diagnosing-skills",
      "Diagnose skills.",
    );

    expect(loadSkillCommands()).toHaveLength(0);
  });

  it("honors the global plugins.enabled=false kill switch (plugin skills only)", () => {
    resetMocks();
    const cacheDir = `${HOME}/.zcode/cli/plugins/cache`;
    mockFiles.set(
      `${HOME}/.zcode/cli/config.json`,
      JSON.stringify({ plugins: { enabled: false } }),
    );
    mockDirs.add(cacheDir);
    mockDirs.add(`${cacheDir}/zcode-plugins-official`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf/0.1.7`);
    mockDirs.add(`${cacheDir}/zcode-plugins-official/pdf/0.1.7/skills`);
    setSkill(`${cacheDir}/zcode-plugins-official/pdf/0.1.7/skills`, "pdf", "PDF toolkit.");
    setSkill(`${HOME}/.zcode/skills`, "user-skill", "A user skill.");

    // Plugin roots die with the switch; user-scope skills survive (the
    // runtime only gates resolvePluginSkillRootDescriptors).
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$user-skill");
  });

  it("keeps SKILL.md without description (ZCode lists it with an empty one)", () => {
    resetMocks();
    mockDirs.add(`${HOME}/.zcode/skills`);
    mockDirs.add(`${HOME}/.zcode/skills/no-desc`);
    mockFiles.set(
      `${HOME}/.zcode/skills/no-desc/SKILL.md`,
      `---\nname: no-desc\n---\n\nNo description field.`,
    );
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$no-desc");
    expect(skills[0]!.description).toBe("");
  });

  it("uses directory name when frontmatter has no name field", () => {
    resetMocks();
    mockDirs.add(`${HOME}/.zcode/skills`);
    mockDirs.add(`${HOME}/.zcode/skills/unnamed`);
    mockFiles.set(
      `${HOME}/.zcode/skills/unnamed/SKILL.md`,
      `---\ndescription: Has desc but no name.\n---\n\nContent.`,
    );
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("$unnamed");
  });

  it("omits input.hint when skill has no argument-hint (sends immediately)", () => {
    resetMocks();
    setSkill(`${HOME}/.zcode/skills`, "tdd", "Test-driven development.");
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.input).toBeUndefined();
  });

  it("sets input.hint from argument-hint frontmatter (waits for input)", () => {
    resetMocks();
    setSkill(
      `${HOME}/.zcode/skills`,
      "handoff",
      "Compress conversation into a handoff document.",
      '\nargument-hint: "What is the next session for?"',
    );
    const skills = loadSkillCommands();
    expect(skills).toHaveLength(1);
    expect(skills[0]!.input).toEqual({ hint: "What is the next session for?" });
  });

  it("reads user skills and the CLI config from ZCODE_HOME when set", () => {
    resetMocks();

    // Skills under an isolated data root must be honored; the real ~/.zcode
    // must be ignored entirely.
    const altRoot = path.join(HOME, "zcode-alt-home");
    setSkill(`${altRoot}/skills`, "alt-skill", "Lives in the alternate data root.");
    setSkill(`${HOME}/.zcode/skills`, "real-home-skill", "Lives in the real home.");

    vi.stubEnv("ZCODE_HOME", altRoot);
    try {
      const skills = loadSkillCommands();
      expect(skills).toHaveLength(1);
      expect(skills[0]!.name).toBe("$alt-skill");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("loadProjectSkillCommands", () => {
  it("scans both <cwd>/.zcode/skills and <cwd>/.agents/skills", () => {
    resetMocks();
    const project = "/srv/proj";
    setSkill(`${project}/.zcode/skills`, "deploy", "Deploy the project.");
    setSkill(`${project}/.agents/skills`, "review", "Review code.");
    const skills = loadProjectSkillCommands(project);
    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(["$deploy", "$review"]);
  });

  it("never touches the process startup cwd or user scope", () => {
    resetMocks();
    setSkill(`${HOME}/.zcode/skills`, "user-skill", "User scope.");
    const skills = loadProjectSkillCommands("/srv/empty-proj");
    expect(skills).toEqual([]);
  });

  it("deduplicates by name (.zcode wins over .agents)", () => {
    resetMocks();
    const project = "/srv/proj";
    setSkill(`${project}/.zcode/skills`, "dup", "From .zcode.");
    setSkill(`${project}/.agents/skills`, "dup", "From .agents.");
    const skills = loadProjectSkillCommands(project);
    expect(skills).toHaveLength(1);
    expect(skills[0]!.description).toBe("From .zcode.");
  });
});
