/**
 * Global user configuration (~/.config/zcode-acp/config.json).
 *
 * The file is the AUTHORITATIVE source for user preferences that must not
 * depend on how a process was launched: the hub daemon is idle-exited and
 * re-spawned by whichever bridge needs it next, so its birth env rotates
 * between GUI-launched editors (no shell rc vars) and interactive shells.
 * Every read is live (no cache) — editing the file takes effect on the next
 * use (e.g. the next remote incubation) without restarting the hub.
 *
 * Precedence everywhere: config file > environment variable > built-in
 * default. Env vars remain fully supported as a fallback for setups without
 * a file and for one-off/test overrides of unspecified fields.
 *
 * Per-process plumbing (ZCODE_ACP_REMOTE_ORIGIN, _PIN_CWD,
 * ZCODE_ACP_RESUME_SESSION) is deliberately NOT file-configurable — those
 * carry per-request/per-role state, not user preference.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { warn } from "../utils.js";
/** Resolve the config file path: $XDG_CONFIG_HOME/zcode-acp or ~/.config/zcode-acp. */
export function userConfigPath(env = process.env) {
    const base = (env.XDG_CONFIG_HOME ?? "").trim() || path.join(homedir(), ".config");
    return path.join(base, "zcode-acp", "config.json");
}
function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
/**
 * Read and validate the user config. Best-effort: a missing file is the
 * normal no-file path ({}), anything unreadable/malformed warns once and
 * reads as absent so the env fallback keeps the process working.
 */
export function loadUserConfig(env = process.env) {
    const file = userConfigPath(env);
    let raw;
    try {
        raw = readFileSync(file, "utf8");
    }
    catch {
        return {}; // missing (or unreadable) file — env fallback applies
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        warn(`config: ${file} is not valid JSON — ignoring (${e instanceof Error ? e.message : String(e)})`);
        return {};
    }
    if (!isPlainObject(parsed)) {
        warn(`config: ${file} is not a JSON object — ignoring`);
        return {};
    }
    const remote = parsed["remote"];
    if (remote === undefined)
        return {};
    if (!isPlainObject(remote)) {
        warn(`config: "remote" in ${file} is not an object — ignoring the section`);
        return {};
    }
    const out = {};
    if (typeof remote["enabled"] === "boolean")
        out.enabled = remote["enabled"];
    if (typeof remote["token"] === "string" && remote["token"].trim())
        out.token = remote["token"].trim();
    for (const key of ["hubPort", "bridgePort"]) {
        const v = remote[key];
        if (v === undefined)
            continue;
        if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 65535) {
            warn(`config: remote.${key}=${JSON.stringify(v)} is not a valid port — ignoring`);
        }
        else {
            out[key] = v;
        }
    }
    if (typeof remote["hubHost"] === "string" && remote["hubHost"].trim()) {
        out.hubHost = remote["hubHost"].trim();
    }
    const terminal = remote["terminal"];
    if (isPlainObject(terminal)) {
        const t = {};
        if (typeof terminal["enabled"] === "boolean")
            t.enabled = terminal["enabled"];
        if (Array.isArray(terminal["terminals"])) {
            const list = terminal["terminals"]
                .filter((v) => typeof v === "string" && !!v.trim())
                .map((v) => v.trim());
            if (list.length > 0)
                t.terminals = list;
        }
        else if (terminal["terminals"] !== undefined) {
            warn(`config: remote.terminal.terminals in ${file} is not an array of names — ignoring`);
        }
        if (typeof terminal["app"] === "string" && terminal["app"].trim())
            t.app = terminal["app"].trim();
        if (typeof terminal["command"] === "string" && terminal["command"].trim()) {
            t.command = terminal["command"].trim();
        }
        if (Object.keys(t).length > 0)
            out.terminal = t;
    }
    else if (terminal !== undefined) {
        warn(`config: remote.terminal in ${file} is not an object — ignoring`);
    }
    return { remote: out };
}
//# sourceMappingURL=user-config.js.map