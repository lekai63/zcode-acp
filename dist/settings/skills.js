/**
 * Skill management: discovery plus the actions the app's skills page offers.
 *
 * `config/skill-discovery.ts` exists to build the editor's command list, so it
 * filters out disabled skills and drops the SKILL.md path (its `input.hint` is
 * the author's argument hint, not a location). Neither works for management —
 * a disabled skill must stay visible so the user can re-enable it, and every
 * action needs the real path. So discovery is re-done here, over the same roots
 * and with the same frontmatter rules.
 *
 * Escape guards are the point of this module: a skill path is client-supplied
 * text that becomes a filesystem operation. Every path is resolved through
 * `realpath` (collapsing symlinks and `..`) BEFORE the containment check, so
 * `~/.zcode/skills/../../../etc` or a symlink pointing outside the roots can
 * neither delete nor copy anything outside them. The app's own delete path
 * carries the same guard.
 */
import { cp, mkdir, readFile, realpath, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setSkillEnabled } from "./cli-config.js";
import { log, zcodeHomeDir } from "../utils.js";
/**
 * Discovery roots, in the app's own order: user scope first (its skills win a
 * name clash), then the shared `~/.agents` root, then plugin caches.
 */
export function skillRoots() {
    const home = zcodeHomeDir();
    return [
        { dir: path.join(home, "skills"), scope: "user", deletable: true },
        { dir: path.join(homedir(), ".agents", "skills"), scope: "agents", deletable: true },
        { dir: path.join(home, "cli", "plugins", "cache"), scope: "plugin", deletable: false },
    ];
}
/** The user-scope root new skills are copied into. */
export function userSkillsRoot() {
    return path.join(zcodeHomeDir(), "skills");
}
/** Resolve through symlinks; fall back to the lexical form when absent. */
async function resolveReal(target) {
    try {
        return await realpath(target);
    }
    catch {
        return path.resolve(target);
    }
}
/** True when `target` is `root` itself or inside it — both sides resolved. */
async function isInside(target, root) {
    const rel = path.relative(await resolveReal(root), await resolveReal(target));
    return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}
/** Minimal SKILL.md frontmatter reader — name and description only. */
function parseSkillFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match)
        return {};
    const fm = {};
    for (const line of match[1].split(/\r?\n/)) {
        const idx = line.indexOf(":");
        if (idx <= 0)
            continue;
        let value = line.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        fm[line.slice(0, idx).trim()] = value;
    }
    return fm;
}
/**
 * The set of disabled SKILL.md paths from `cli/config.json`.
 *
 * Keys are normalized (backslashes to forward slashes) the way the app
 * normalizes them, so a config written on Windows still matches a POSIX
 * discovery path.
 */
async function disabledSkillPaths() {
    try {
        const raw = await readFile(path.join(zcodeHomeDir(), "cli", "config.json"), "utf8");
        const parsed = JSON.parse(raw);
        const out = new Set();
        for (const [key, value] of Object.entries(parsed.skills ?? {})) {
            if (value?.enable === false)
                out.add(key.replace(/\\/gu, "/"));
        }
        return out;
    }
    catch {
        return new Set();
    }
}
/**
 * Every skill, enabled or not.
 *
 * Duplicate names are kept rather than de-duplicated: the app lists the same
 * name from two scopes separately (they are different files), and hiding one
 * would make its toggle unreachable.
 */
export async function listSkills() {
    const disabled = await disabledSkillPaths();
    const out = [];
    for (const root of skillRoots()) {
        let entries;
        try {
            entries = await readdirSafe(root.dir);
        }
        catch {
            continue; // root absent — normal on a machine without that source
        }
        for (const entry of entries) {
            const dir = path.join(root.dir, entry);
            const skillMd = path.join(dir, "SKILL.md");
            try {
                if (!(await stat(dir)).isDirectory())
                    continue;
            }
            catch {
                continue;
            }
            let content;
            try {
                content = await readFile(skillMd, "utf8");
            }
            catch {
                continue; // not a skill directory
            }
            const fm = parseSkillFrontmatter(content);
            const name = fm["name"] ?? entry;
            if (!name || !fm["description"])
                continue; // the runtime skips these too
            if (fm["user-invocable"] === "false")
                continue;
            const absPath = path.resolve(skillMd);
            out.push({
                name,
                description: fm["description"],
                path: absPath,
                dir,
                scope: root.scope,
                enabled: !disabled.has(absPath.replace(/\\/gu, "/")),
            });
        }
    }
    out.sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
    return out;
}
async function readdirSafe(dir) {
    const { readdir } = await import("node:fs/promises");
    try {
        return await readdir(dir);
    }
    catch {
        return [];
    }
}
/** Enable or disable a skill by its SKILL.md path. */
export async function setSkillEnabledByPath(skillPath, enable) {
    assertSkillPath(skillPath);
    // The stored key uses forward slashes regardless of platform.
    await setSkillEnabled(skillPath.replace(/\\/gu, "/"), enable);
}
function assertSkillPath(skillPath) {
    if (!path.isAbsolute(skillPath)) {
        throw new Error("skill path must be absolute");
    }
    if (path.basename(skillPath) !== "SKILL.md") {
        throw new Error("skill path must point at a SKILL.md file");
    }
}
/**
 * Delete a skill directory.
 *
 * Only skills inside a deletable root can go: a plugin's skill belongs to the
 * plugin install and would reappear on the next update, so the API refuses
 * rather than deleting something that comes back. The containment check runs on
 * RESOLVED paths, so a symlinked skill directory cannot point the delete at
 * something outside the roots.
 */
export async function deleteSkill(skillPath) {
    assertSkillPath(skillPath);
    const dir = path.dirname(skillPath);
    // Every deletable root counts, not just the first one — the agents scope
    // (`~/.agents/skills`) is listed and copyable, so refusing to delete it made
    // half the listed skills undeletable.
    const roots = skillRoots().filter((r) => r.deletable);
    let root;
    for (const candidate of roots) {
        if (await isInside(dir, candidate.dir)) {
            root = candidate;
            break;
        }
    }
    if (!root) {
        throw new Error("only skills under the user skill roots can be deleted");
    }
    // `isInside` treats the root itself as contained — refuse that explicitly.
    if ((await resolveReal(dir)) === (await resolveReal(root.dir))) {
        throw new Error("refusing to delete the skills root itself");
    }
    await rm(dir, { recursive: true, force: true });
}
/**
 * Copy a skill into the user root.
 *
 * A name collision is refused rather than merged: silently merging two skill
 * directories yields a SKILL.md whose description matches neither original.
 */
export async function copySkillToUser(skillPath) {
    assertSkillPath(skillPath);
    const sourceDir = path.dirname(skillPath);
    // Containment on resolved paths: a symlinked skill elsewhere on disk must not
    // be copyable through this API.
    let owned = false;
    for (const root of skillRoots()) {
        if (root.scope !== "plugin" && (await isInside(sourceDir, root.dir))) {
            owned = true;
            break;
        }
    }
    if (!owned) {
        throw new Error("only skills under the user skill roots can be copied");
    }
    const targetRoot = userSkillsRoot();
    const name = path.basename(sourceDir);
    const target = path.join(targetRoot, name);
    if ((await resolveReal(target)) === (await resolveReal(sourceDir))) {
        throw new Error("this skill already lives in the user skills root");
    }
    try {
        if ((await stat(target)).isDirectory()) {
            throw new Error(`a skill named '${name}' already exists in the user skills root`);
        }
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
    await mkdir(targetRoot, { recursive: true });
    await cp(sourceDir, target, { recursive: true });
    log(`settings: copied skill '${name}' to ${target}`);
    return path.join(target, "SKILL.md");
}
//# sourceMappingURL=skills.js.map