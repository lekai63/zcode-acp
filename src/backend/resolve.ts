/**
 * Resolve the argv to launch the ZCode app-server subprocess.
 *
 * The ZCode CLI is a Node `.cjs` that relies on a `#!/usr/bin/env node` shebang.
 * Processes launched by GUI launchd (no shell profile) have no `node` on PATH,
 * so the shebang fails. We sidestep it by constructing `[node, zcode.cjs,
 * "app-server", "--stdio"]` with an explicit, sqlite-capable Node binary.
 */

import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

import { log, warn, zcodePersonalProviderPath } from "../utils.js";

/** `which bin` — resolve a binary on PATH without external deps. */
function whichSync(bin: string): string | null {
  try {
    const out = execFileSync("which", [bin], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Glob the Zed-bundled node directories, newest version first. */
function zedBundledNodes(): string[] {
  const base = path.join(os.homedir(), "Library/Application Support/Zed/node");
  if (!existsSync(base)) return [];
  let entries: string[] = [];
  try {
    entries = readdirSync(base);
  } catch {
    return [];
  }
  return entries
    .filter((d) => d.startsWith("node-v"))
    .sort()
    .reverse()
    .map((d) => path.join(base, d, "bin", "node"));
}

/**
 * Candidate Node binaries in priority order. Deduped, order-preserving.
 * Falls back to the Zed-bundled Node glob as a last resort.
 */
function candidateNodeBinaries(): string[] {
  const cands: string[] = [];
  const envNode = process.env.ZCODE_NODE;
  if (envNode) cands.push(envNode);
  cands.push("/opt/homebrew/bin/node", "/usr/local/bin/node");
  const whichNode = whichSync("node");
  if (whichNode) cands.push(whichNode);
  cands.push(...zedBundledNodes());
  const seen = new Set<string>();
  return cands.filter((c) => {
    if (!c || seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}

/**
 * Verify a Node binary can load `node:sqlite` (ZCode depends on it; Node < 22
 * lacks the module and would crash). Uses `new DatabaseSync(...)` because a
 * bare reference would mis-detect support.
 */
function nodeSupportsSqlite(nodeBin: string): boolean {
  if (!nodeBin || !existsSync(nodeBin)) return false;
  try {
    execFileSync(nodeBin, ["-e", "new (require('node:sqlite').DatabaseSync)(':memory:')"], {
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Well-known desktop-app bundle locations of the shipped `zcode.cjs`
 * (mirrors the per-platform table in README). The app never adds the CLI to
 * PATH, so a bare terminal launch of the REPL/editor bridge finds it here.
 */
function bundledZcodeCandidates(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
    return [path.join(localAppData, "Programs", "ZCode", "resources", "glm", "zcode.cjs")];
  }
  return [
    "/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs",
    path.join(home, "Applications/ZCode.app/Contents/Resources/glm/zcode.cjs"),
    "/opt/ZCode/resources/glm/zcode.cjs",
    "/usr/share/zcode/resources/glm/zcode.cjs",
  ];
}

/**
 * Resolution chain for the zcode CLI when ZCODE_BIN is unset: PATH first
 * (absolute path so the spawn no longer depends on the child's PATH), then
 * the desktop-app bundle locations. `null` when nothing is found — the caller
 * falls back to the bare name and lets spawn surface the failure.
 */
function discoverZcodeBin(): string | null {
  const onPath = whichSync("zcode");
  if (onPath) return onPath;
  for (const c of bundledZcodeCandidates()) {
    if (existsSync(c)) return c;
  }
  return null;
}

// ---------- provider-runtime env injection (3.12.3+ desktop bundles) ----------

/**
 * The CLI's built-in provider table. The desktop app's host resolves it as
 * `<resources>/config/provider/zcode-builtin.json` and hands it to the CLI via
 * `ZCODE_BUILTIN_PROVIDER_CONFIG_FILE` (verified in app.asar 3.12.3 — the env
 * skips the CLI's own file lookup entirely). That lookup only knows the
 * npm/dev layouts (`<entryDir>/provider/` and a five-up `config/` for the
 * monorepo tree), so a .app-bundled `zcode.cjs` launched bare exits during
 * boot with `无法定位 CLI ZCode Built-in Provider Config` (observed 2026-09:
 * exit 1 in <1s, every bridge backend spawn dead until the CLI's
 * `~zcode/v2/runtime/provider` sync happens to run — which itself needs a
 * valid source, so post-update machines sit dead).
 */
const PROVIDER_CONFIG_NAME = "zcode-builtin.json";
export const BUILTIN_PROVIDER_ENV = "ZCODE_BUILTIN_PROVIDER_CONFIG_FILE";
export const PERSONAL_PROVIDER_ENV = "ZCODE_PERSONAL_PROVIDER_CONFIG_FILE";

/**
 * Env vars pointing the CLI at its provider tables, mirroring the desktop
 * host's own injection. Locates the builtin file next to the resolved CLI
 * entry (sibling `provider/` — npm/dev layout — or `../config/provider/` —
 * the .app bundle layout) and returns BOTH
 * `{ZCODE_BUILTIN_PROVIDER_CONFIG_FILE, ZCODE_PERSONAL_PROVIDER_CONFIG_FILE}`;
 * `{}` when the entry is not a JS file, is missing, or carries no provider
 * config anywhere (old CLIs, PATH installs) — those boot without one.
 *
 * BOTH vars are required: the CLI's provider bootstrap uses the injected
 * builtin path VERBATIM only when the personal var is set too — with the
 * builtin alone it re-syncs the table into a version-keyed runtime copy
 * (`~/.zcode/v2/runtime/provider/<plat>/<version>/<endpoint dir>/zcode-builtin.json`)
 * and rewires
 * its configRevision to THAT copy's path. The account-config push's
 * `basedOnZcodeBuiltinRevision` hashes the injected path, so any rewire
 * silently voids the push and every account model answers "Provider
 * Registry 中不存在 Model" (observed 2026-09: one terminal env took the
 * re-sync path deterministically while another never did). The personal
 * value is the CLI's own default location, just made explicit to unlock the
 * verbatim branch.
 *
 * The derived value deliberately OVERRIDES any inherited ambient env: the
 * host injects version-keyed runtime paths
 * (`…/runtime/provider/<plat>/<appVersion>/endpoint-<hash>/zcode-builtin.json`)
 * that go stale or vanish across app updates, while the derived path always
 * matches the entry about to be launched. Only a {} result (no adjacent
 * config) leaves the ambient value untouched — for a non-bundled CLI that
 * ambient value is the best hint.
 */
export function builtinProviderEnv(entryArg?: string): NodeJS.ProcessEnv {
  const entry = entryArg ?? process.env.ZCODE_BIN ?? discoverZcodeBin();
  if (!entry || !/\.(cjs|mjs|js)$/.test(entry)) return {};
  const abs = path.resolve(entry);
  if (!existsSync(abs)) return {};
  const dir = path.dirname(abs);
  const candidates = [
    path.join(dir, "provider", PROVIDER_CONFIG_NAME),
    path.join(dir, "..", "config", "provider", PROVIDER_CONFIG_NAME),
  ];
  const found = candidates.find((c) => existsSync(c));
  if (!found) return {};
  const personal = zcodePersonalProviderPath();
  return existsSync(personal)
    ? { [BUILTIN_PROVIDER_ENV]: found, [PERSONAL_PROVIDER_ENV]: personal }
    : { [BUILTIN_PROVIDER_ENV]: found };
}

// ---------- desktop app version (model-request client version) ----------

/**
 * The desktop host hands the CLI its app version as `ZCODE_APP_VERSION`
 * (packages/desktop/src/main/desktopRuntimeEnv.ts), and the CLI stamps it on
 * every model request: `User-Agent: ZCode/<v>`, `X-ZCode-App-Version`, and the
 * Coding Plan signer's `X-Client-Version`, which takes
 * `X-ZCode-App-Version ?? <CLI version>`. Launched bare, the CLI falls back to
 * its own version, so a 3.14.0 desktop bundle reported `0.16.9` on all three
 * (captured 2026-10-10) while the same bundle under the app reports `3.14.0`.
 *
 * The app version is the `version` of the bundle's `app.asar` package.json:
 * the same root package.json the desktop build stamps into its version
 * constant (scripts/build-metadata.mjs strips leading non-digits). The
 * archive is `<resources>/app.asar` next to the CLI's `glm/` directory on
 * every platform; a `zcode` launcher symlink resolves to the app binary,
 * whose `resources/` (`../Resources/` on macOS) holds it.
 *
 * An explicit ZCODE_APP_VERSION wins: it is already in the inherited env, so
 * this returns {}. A CLI outside a desktop bundle (npm, PATH installs) also
 * gets {} and keeps reporting its own version.
 */
export const APP_VERSION_ENV = "ZCODE_APP_VERSION";

/** Header JSON above this size is not a desktop bundle worth parsing. */
const MAX_ASAR_HEADER_BYTES = 64 * 1024 * 1024;

/** Parsed versions keyed by `path:size:mtime` — the header is ~7MB of JSON. */
const asarVersionCache = new Map<string, string | null>();

export function desktopAppVersionEnv(entryArg?: string): NodeJS.ProcessEnv {
  if (process.env[APP_VERSION_ENV]?.trim()) return {};
  const entry = entryArg ?? process.env.ZCODE_BIN ?? discoverZcodeBin();
  if (!entry) return {};
  let real: string;
  try {
    real = realpathSync(entry);
  } catch {
    return {};
  }
  const dir = path.dirname(real);
  const candidates = [
    path.join(dir, "..", "app.asar"),
    path.join(dir, "resources", "app.asar"),
    path.join(dir, "..", "Resources", "app.asar"),
  ];
  for (const asar of candidates) {
    const version = asarPackageVersion(asar);
    if (version) return { [APP_VERSION_ENV]: version };
  }
  return {};
}

function asarPackageVersion(asar: string): string | null {
  let key: string;
  try {
    const st = statSync(asar);
    if (!st.isFile()) return null;
    key = `${asar}:${st.size}:${st.mtimeMs}`;
  } catch {
    return null;
  }
  const cached = asarVersionCache.get(key);
  if (cached !== undefined) return cached;
  let version: string | null = null;
  try {
    version = readAsarPackageVersion(asar);
  } catch (e) {
    log(`resolve: cannot read the app version from ${asar}: ${e instanceof Error ? e.message : e}`);
  }
  asarVersionCache.set(key, version);
  if (version) log(`resolve: desktop app version ${version} (from ${asar})`);
  return version;
}

/**
 * Read `package.json` → `version` from an asar archive without unpacking it.
 *
 * Layout: an 8-byte size pickle (`4`, header pickle size), then the header
 * pickle (payload size, JSON byte length, JSON). File offsets in the JSON are
 * relative to the end of the header pickle, i.e. `8 + headerPickleSize`. An
 * entry flagged `unpacked` lives in the sibling `app.asar.unpacked/` tree.
 */
function readAsarPackageVersion(asar: string): string | null {
  const fd = openSync(asar, "r");
  try {
    const prefix = Buffer.alloc(16);
    if (readSync(fd, prefix, 0, 16, 0) !== 16 || prefix.readUInt32LE(0) !== 4) return null;
    const headerSize = prefix.readUInt32LE(4);
    const jsonLength = prefix.readUInt32LE(12);
    if (jsonLength === 0 || jsonLength > headerSize || jsonLength > MAX_ASAR_HEADER_BYTES) {
      return null;
    }
    const json = Buffer.alloc(jsonLength);
    if (readSync(fd, json, 0, jsonLength, 16) !== jsonLength) return null;
    const header = JSON.parse(json.toString("utf8")) as {
      files?: Record<string, { offset?: string; size?: number; unpacked?: boolean }>;
    };
    const file = header.files?.["package.json"];
    if (!file || typeof file.size !== "number" || file.size <= 0 || file.size > 1024 * 1024) {
      return null;
    }
    let raw: Buffer;
    if (file.unpacked) {
      raw = readFileSync(path.join(`${asar}.unpacked`, "package.json"));
    } else {
      const offset = Number(file.offset);
      if (!Number.isSafeInteger(offset) || offset < 0) return null;
      raw = Buffer.alloc(file.size);
      if (readSync(fd, raw, 0, file.size, 8 + headerSize + offset) !== file.size) return null;
    }
    return normalizeAppVersion((JSON.parse(raw.toString("utf8")) as { version?: unknown }).version);
  } finally {
    closeSync(fd);
  }
}

/** The desktop build's own normalization, plus the CLI's printable-header rule. */
function normalizeAppVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const version = value.trim().replace(/^[^\d]*/, "");
  return version && /^[\x20-\x7e]+$/.test(version) ? version : null;
}

/**
 * Translate the bridge's `ZCODE_HOME` into the backend's own data-root
 * spelling for the spawn.
 *
 * The bridge reads the ZCode data tree through `ZCODE_HOME` (it replaces
 * `~/.zcode` outright — utils.ts zcodeHomeDir), but the backend's contract is
 * `ZCODE_DATA_BASE_DIR`: the PARENT of `.zcode`
 * (packages/services/src/paths.ts:11,33-45 — getZCodeDataRootDir() is
 * `join(getDataBaseDir(), ".zcode")`; provider-runtime-env.ts:60,76 reads the
 * same var). Without the translation, a bridge running against an isolated
 * tree discovers skills/MCP/credentials there while the spawned backend still
 * reads the real `~/.zcode` — split-brain. An unset ZCODE_HOME returns {} so
 * any ambient ZCODE_DATA_BASE_DIR passes through untouched.
 *
 * The translation only EXISTS when the tree's basename is `.zcode` — the
 * backend unconditionally appends `.zcode` to the base dir, so a differently
 * named tree cannot be projected onto it at all. dirname() of such a path
 * would point the backend at a sibling `.zcode` that may belong to someone
 * else entirely; leaving the env unset (backend reads the ambient default)
 * and warning is the honest failure — the mismatch is visible instead of
 * silently wired to the wrong tree.
 */
let warnedNonZcodeHome = false;
export function zcodeDataBaseDirEnv(): NodeJS.ProcessEnv {
  const home = process.env.ZCODE_HOME?.trim();
  if (!home) return {};
  const resolved = path.resolve(home);
  if (path.basename(resolved) !== ".zcode") {
    if (!warnedNonZcodeHome) {
      warnedNonZcodeHome = true;
      warn(
        `ZCODE_HOME='${resolved}' does not end in '.zcode' — the backend only understands a ` +
          `base dir + '.zcode', so it will NOT see this tree (leaving ZCODE_DATA_BASE_DIR unset)`,
      );
    }
    return {};
  }
  return { ZCODE_DATA_BASE_DIR: path.dirname(resolved) };
}

/**
 * Happy Eyeballs (`autoSelectFamily`, on by default since Node 20.13) gives
 * each connect attempt a 250ms budget. On a network with no IPv6 route where
 * the provider edge answers in just over 250ms, every undici connect is
 * aborted before it can establish and fetch fails with an empty-message
 * AggregateError — every model request then dies as `Cannot connect to API:`
 * no matter how often it retries, while curl/plain connects to the same host
 * succeed. Disabling it restores the pre-20.13 sequential connect, which
 * works. Set ZCODE_KEEP_HAPPY_EYEBALLS=1 to keep RFC 8305 behavior.
 *
 * Disabling it also removes the dual-stack fallback: `net.connect` then uses a
 * single-address lookup, so a host that resolves `::1` first but only listens
 * on IPv4 fails hard (ECONNREFUSED) instead of falling through — every local
 * provider configured as `http://localhost:PORT` (IPv4-only listeners) dies.
 * `--dns-result-order=ipv4first` restores the pre-17 lookup order so that
 * single address is the IPv4 one; it only reorders, so an IPv6-only host still
 * resolves to IPv6 and IPv4-only edges still connect directly.
 */
function happyEyeballsArgs(): string[] {
  return process.env.ZCODE_KEEP_HAPPY_EYEBALLS
    ? []
    : ["--no-network-family-autoselection", "--dns-result-order=ipv4first"];
}

/**
 * The backend in app-server mode always registers its Cron* tools, each
 * implemented by asking THIS client over `automation/*` JSON-RPC requests —
 * which the bridge does not serve (host capability, see docs/BACKLOG.md).
 * Advertised-but-unservable tools trap the model, so they are disallowed by
 * default. `ZCODE_ENABLE_AUTOMATION_TOOLS=1` opts back in for a host that
 * does implement the port (#192).
 */
const AUTOMATION_TOOL_DEFAULTS = ["CronCreate", "CronList", "CronUpdate", "CronDelete"];

function disallowedToolsValue(): string | undefined {
  const fromEnv = process.env.ZCODE_DISALLOWED_TOOLS?.trim();
  if (process.env.ZCODE_ENABLE_AUTOMATION_TOOLS === "1") {
    return fromEnv || undefined;
  }
  const user = fromEnv ? fromEnv.split(/[,\s]+/).filter(Boolean) : [];
  const merged = [...new Set([...user, ...AUTOMATION_TOOL_DEFAULTS])];
  return merged.length > 0 ? merged.join(" ") : undefined;
}

/**
 * The backend subcommand and its flags, shared by every launch path.
 *
 * `ZCODE_DISALLOWED_TOOLS` is merged with the default Cron* disallow list
 * (see AUTOMATION_TOOL_DEFAULTS) and passed as the app-server's
 * `--disallowed-tools` value; unset means only the defaults.
 */
export function backendArgs(): string[] {
  const disallowed = disallowedToolsValue();
  return ["app-server", "--stdio", ...(disallowed ? ["--disallowed-tools", disallowed] : [])];
}

/** Resolve the full argv to launch `zcode app-server --stdio`. */
export function resolveZcodeCommand(): string[] {
  const zcodeBin = process.env.ZCODE_BIN ?? discoverZcodeBin() ?? "zcode";
  // Non-JS bin (e.g. a `zcode` command or wrapper) → use as-is, rely on its own shebang.
  if (!/\.(cjs|mjs|js)$/.test(zcodeBin)) {
    return [zcodeBin, ...backendArgs()];
  }
  // JS file → launch with an explicit sqlite-capable Node to bypass the shebang.
  for (const nodeBin of candidateNodeBinaries()) {
    if (nodeSupportsSqlite(nodeBin)) {
      let ver = "?";
      try {
        // argv form (no shell, space-safe); capture stderr so it doesn't leak.
        ver = execFileSync(nodeBin, ["--version"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }).trim();
      } catch {
        // keep "?"
      }
      log(`resolve: launching zcode with node ${nodeBin} (${ver})`);
      return [nodeBin, ...happyEyeballsArgs(), zcodeBin, ...backendArgs()];
    }
  }
  log(
    "resolve: no sqlite-capable node found; falling back to PATH-resolved zcode shebang " +
      "(may fail under GUI launch)",
  );
  return [zcodeBin, ...backendArgs()];
}
