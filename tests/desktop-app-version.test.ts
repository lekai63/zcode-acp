/**
 * desktopAppVersionEnv tests — the desktop host's `ZCODE_APP_VERSION`
 * injection.
 *
 * The CLI stamps `ZCODE_APP_VERSION` on every model request (`User-Agent`,
 * `X-ZCode-App-Version`, the signer's `X-Client-Version`) and falls back to
 * its own version when it is unset, so a bare spawn of a 3.14.0 desktop
 * bundle reported `0.16.9` (captured 2026-10-10). The bridge reads the app
 * version from the bundle's `app.asar` package.json, as the desktop build
 * stamps it.
 *
 * Fixtures are real asar archives under hermetic temp trees; nothing writes
 * outside tmpdir.
 */

import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { APP_VERSION_ENV, desktopAppVersionEnv } from "../src/backend/resolve.js";

const SAVED = {
  ZCODE_APP_VERSION: process.env.ZCODE_APP_VERSION,
  ZCODE_BIN: process.env.ZCODE_BIN,
};

afterEach(() => {
  for (const [k, v] of Object.entries(SAVED)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

/** Write a minimal asar holding `files` (name → contents) at `asar`. */
function writeAsar(
  asar: string,
  files: Record<string, string>,
  unpacked: readonly string[] = [],
): void {
  const entries: Record<string, { size: number; offset?: string; unpacked?: boolean }> = {};
  const blobs: Buffer[] = [];
  let offset = 0;
  for (const [name, contents] of Object.entries(files)) {
    const data = Buffer.from(contents);
    if (unpacked.includes(name)) {
      entries[name] = { size: data.length, unpacked: true };
      continue;
    }
    entries[name] = { size: data.length, offset: String(offset) };
    blobs.push(data);
    offset += data.length;
  }
  const json = Buffer.from(JSON.stringify({ files: entries }));
  const pad = (4 - (json.length % 4)) % 4;
  const header = Buffer.alloc(8 + json.length + pad);
  header.writeUInt32LE(4 + json.length + pad, 0);
  header.writeUInt32LE(json.length, 4);
  json.copy(header, 8);
  const sizePickle = Buffer.alloc(8);
  sizePickle.writeUInt32LE(4, 0);
  sizePickle.writeUInt32LE(header.length, 4);
  writeFileSync(asar, Buffer.concat([sizePickle, header, ...blobs]));
}

/** Build `<root>/resources/{glm/zcode.cjs, app.asar}` and return the CLI entry. */
function makeDesktopBundle(root: string, version: string): string {
  const resources = path.join(root, "resources");
  mkdirSync(path.join(resources, "glm"), { recursive: true });
  writeFileSync(path.join(resources, "glm", "zcode.cjs"), "// fake cli");
  writeAsar(path.join(resources, "app.asar"), {
    "index.js": "// main",
    "package.json": JSON.stringify({ name: "@zcode/desktop", version }),
  });
  return path.join(resources, "glm", "zcode.cjs");
}

describe("desktopAppVersionEnv", () => {
  it("reads the app version from <resources>/app.asar next to the bundled CLI", () => {
    delete process.env.ZCODE_APP_VERSION;
    const entry = makeDesktopBundle(mkdtempSync(path.join(tmpdir(), "zcode-app-")), "3.14.0");

    expect(desktopAppVersionEnv(entry)).toEqual({ [APP_VERSION_ENV]: "3.14.0" });
  });

  it("honors ZCODE_BIN as the entry when no explicit entry is passed", () => {
    delete process.env.ZCODE_APP_VERSION;
    process.env.ZCODE_BIN = makeDesktopBundle(
      mkdtempSync(path.join(tmpdir(), "zcode-app-")),
      "3.15.1",
    );

    expect(desktopAppVersionEnv()).toEqual({ [APP_VERSION_ENV]: "3.15.1" });
  });

  it("leaves an explicit ZCODE_APP_VERSION alone", () => {
    process.env.ZCODE_APP_VERSION = "9.9.9";
    const entry = makeDesktopBundle(mkdtempSync(path.join(tmpdir(), "zcode-app-")), "3.14.0");

    expect(desktopAppVersionEnv(entry)).toEqual({});
  });

  it("follows a launcher symlink to the app binary's resources/", () => {
    delete process.env.ZCODE_APP_VERSION;
    const root = mkdtempSync(path.join(tmpdir(), "zcode-app-"));
    makeDesktopBundle(root, "3.14.0");
    writeFileSync(path.join(root, "zcode"), "#!/bin/sh\n");
    const bin = mkdtempSync(path.join(tmpdir(), "zcode-bin-"));
    symlinkSync(path.join(root, "zcode"), path.join(bin, "zcode"));

    expect(desktopAppVersionEnv(path.join(bin, "zcode"))).toEqual({
      [APP_VERSION_ENV]: "3.14.0",
    });
  });

  it("reads an unpacked package.json from app.asar.unpacked/", () => {
    delete process.env.ZCODE_APP_VERSION;
    const resources = path.join(mkdtempSync(path.join(tmpdir(), "zcode-app-")), "resources");
    mkdirSync(path.join(resources, "glm"), { recursive: true });
    writeFileSync(path.join(resources, "glm", "zcode.cjs"), "// fake cli");
    const pkg = JSON.stringify({ version: "3.14.2" });
    writeAsar(path.join(resources, "app.asar"), { "package.json": pkg }, ["package.json"]);
    mkdirSync(path.join(resources, "app.asar.unpacked"));
    writeFileSync(path.join(resources, "app.asar.unpacked", "package.json"), pkg);

    expect(desktopAppVersionEnv(path.join(resources, "glm", "zcode.cjs"))).toEqual({
      [APP_VERSION_ENV]: "3.14.2",
    });
  });

  it("strips leading non-digits like the desktop build does", () => {
    delete process.env.ZCODE_APP_VERSION;
    const entry = makeDesktopBundle(mkdtempSync(path.join(tmpdir(), "zcode-app-")), "v3.14.0");

    expect(desktopAppVersionEnv(entry)).toEqual({ [APP_VERSION_ENV]: "3.14.0" });
  });

  it("returns {} for a CLI outside a desktop bundle (npm/PATH layout)", () => {
    delete process.env.ZCODE_APP_VERSION;
    const dir = mkdtempSync(path.join(tmpdir(), "zcode-npm-"));
    writeFileSync(path.join(dir, "zcode.cjs"), "// npm cli");

    expect(desktopAppVersionEnv(path.join(dir, "zcode.cjs"))).toEqual({});
  });

  it("returns {} for a corrupt archive instead of throwing", () => {
    delete process.env.ZCODE_APP_VERSION;
    const resources = path.join(mkdtempSync(path.join(tmpdir(), "zcode-app-")), "resources");
    mkdirSync(path.join(resources, "glm"), { recursive: true });
    writeFileSync(path.join(resources, "glm", "zcode.cjs"), "// fake cli");
    writeFileSync(path.join(resources, "app.asar"), "not an asar archive at all");

    expect(desktopAppVersionEnv(path.join(resources, "glm", "zcode.cjs"))).toEqual({});
  });

  it("returns {} for a missing entry", () => {
    delete process.env.ZCODE_APP_VERSION;

    expect(desktopAppVersionEnv(path.join(tmpdir(), "does-not-exist", "zcode.cjs"))).toEqual({});
  });
});
