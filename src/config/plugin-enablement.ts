/**
 * Shared plugin-root resolution for skill/command discovery.
 *
 * Replicates the ZCode runtime's plugin enablement semantics instead of the
 * old "explicit `true` in config.json" reading, which missed every
 * default-enabled official plugin: the CLI only writes `enabledPlugins`
 * entries on explicit user action (e.g. disabling browser-use → `false`), so
 * a config without entries still leaves the shipped content plugins ON.
 * The authoritative rule (ZCode services/skills/skillsService.ts):
 *
 *   enabled = config.plugins.enabledPlugins[`${name}@${marketplace}`]
 *             ?? defaultEnabled
 *
 * where defaultEnabled is true for the official default-on set below
 * (ZCode bootstrap official-plugin-definitions.ts →
 * DEFAULT_ENABLED_OFFICIAL_PLUGIN_IDS) and false for everything else
 * (android-emulator, ios-simulator, computer-use, marketplace installs…).
 *
 * Also honored, same as the runtime:
 *   - `plugins.enabled: false` — the global plugin kill switch.
 *   - `plugins.suppressedBuiltins` — built-ins "uninstalled" from the
 *     desktop stay suppressed even though their cache directory survives.
 *   - `plugins.dirs` — inline plugin roots (default enabled).
 *
 * Best-effort like the callers: any read/parse failure degrades to "no
 * plugins from that source".
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { compareVersions, log, zcodeCliConfigPath, zcodePluginCacheDir } from "../utils.js";

/** Marketplace id of ZCode's built-in official plugin cache. */
const OFFICIAL_MARKETPLACE = "zcode-plugins-official";

/**
 * Official plugins ZCode ships enabled out of the box. Mirrors ZCode's
 * DEFAULT_ENABLED_OFFICIAL_PLUGIN_IDS — update alongside upstream
 * official-plugin-definitions.ts when ZCode adds default-on content plugins.
 */
const DEFAULT_ENABLED_OFFICIAL_PLUGINS = new Set([
  "node-repl-host",
  "browser-use",
  "documents",
  "pdf",
  "presentations",
  "spreadsheets",
  "image-search",
  "plugin-creator",
  "skill-creator",
  "zcode-guide",
]);

/** An enabled plugin's install root (latest cached version resolved). */
export interface EnabledPluginRoot {
  /** Plugin name (cache directory name — matches the manifest name). */
  name: string;
  /** Plugin root: `<cache>/<marketplace>/<name>/<latest-version>` or the inline dir itself. */
  dir: string;
}

interface CliPluginConfig {
  enabled?: boolean;
  enabledPlugins?: Record<string, boolean>;
  suppressedBuiltins?: string[];
  dirs?: string[];
}

/**
 * Read the CLI config's `plugins` section. A missing or unreadable config
 * degenerates to `{}` — the runtime treats it the same way and still scans
 * the official cache with default enablement.
 */
function readPluginConfig(): CliPluginConfig {
  try {
    const cliConfigPath = zcodeCliConfigPath();
    if (!existsSync(cliConfigPath)) return {};
    const cfg = JSON.parse(readFileSync(cliConfigPath, "utf8")) as {
      plugins?: CliPluginConfig;
    };
    return cfg.plugins ?? {};
  } catch (e) {
    log(`plugin-enablement: config read failed (${e instanceof Error ? e.message : String(e)})`);
    return {};
  }
}

/** Expand a config `plugins.dirs` entry (`~`-relative or absolute). */
function expandInlineDir(dir: string): string | null {
  if (!dir) return null;
  const expanded = dir.startsWith("~/")
    ? path.join(homedir(), dir.slice(2))
    : dir.startsWith("~")
      ? homedir()
      : dir;
  if (!path.isAbsolute(expanded)) return null;
  return path.resolve(expanded);
}

/** Latest version subdirectory of `dir` ("" when none is a directory). */
function latestVersionDir(dir: string): string {
  let latest = "";
  try {
    for (const entry of readdirSync(dir)) {
      const vDir = path.join(dir, entry);
      if (statSync(vDir).isDirectory() && compareVersions(entry, latest) > 0) {
        latest = entry;
      }
    }
  } catch {
    // unreadable plugin dir — treat as no versions
  }
  return latest;
}

/**
 * Resolve every enabled plugin's install root, marketplace cache first, then
 * inline `plugins.dirs` roots. Official-marketplace plugins enable via the
 * default-on set; everything else needs an explicit `true`.
 */
export function loadEnabledPluginRoots(): EnabledPluginRoot[] {
  const config = readPluginConfig();
  // Global kill switch — the runtime returns no plugin skill roots at all.
  if (config.enabled === false) return [];

  const enabledPlugins = config.enabledPlugins ?? {};
  const suppressed = new Set(config.suppressedBuiltins ?? []);
  const roots: EnabledPluginRoot[] = [];
  const cacheDir = zcodePluginCacheDir();

  if (existsSync(cacheDir)) {
    let marketplaces: string[];
    try {
      marketplaces = readdirSync(cacheDir);
    } catch {
      marketplaces = [];
    }
    for (const marketplace of marketplaces) {
      const marketDir = path.join(cacheDir, marketplace);
      try {
        if (!statSync(marketDir).isDirectory()) continue;
      } catch {
        continue;
      }
      const official = marketplace === OFFICIAL_MARKETPLACE;
      let plugins: string[];
      try {
        plugins = readdirSync(marketDir);
      } catch {
        continue;
      }
      for (const name of plugins) {
        const pluginId = `${name}@${marketplace}`;
        if (official && suppressed.has(pluginId)) continue;
        const enabled = enabledPlugins[pluginId] ??
          (official ? DEFAULT_ENABLED_OFFICIAL_PLUGINS.has(name) : false);
        if (!enabled) continue;
        const version = latestVersionDir(path.join(marketDir, name));
        if (!version) continue;
        roots.push({ name, dir: path.join(marketDir, name, version) });
      }
    }
  }

  for (const rawDir of config.dirs ?? []) {
    const dir = expandInlineDir(rawDir);
    if (!dir || !existsSync(dir)) continue;
    roots.push({ name: path.basename(dir), dir });
  }

  return roots;
}
