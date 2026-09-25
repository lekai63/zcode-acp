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
/** A discovered skill plus the state the management surface needs. */
export interface SkillEntry {
    name: string;
    description: string;
    /** Absolute path of the SKILL.md file. */
    path: string;
    /** Directory containing SKILL.md. */
    dir: string;
    /** Where it was found, for grouping in a UI. */
    scope: "user" | "agents" | "plugin" | "project";
    /** False when cli/config.json carries `{enable: false}` for this path. */
    enabled: boolean;
}
interface SkillRoot {
    dir: string;
    scope: SkillEntry["scope"];
    /** Plugin skills belong to the plugin install — never deletable. */
    deletable: boolean;
}
/**
 * Discovery roots, in the app's own order: user scope first (its skills win a
 * name clash), then the shared `~/.agents` root, then plugin caches.
 */
export declare function skillRoots(): SkillRoot[];
/** The user-scope root new skills are copied into. */
export declare function userSkillsRoot(): string;
/**
 * Every skill, enabled or not.
 *
 * Duplicate names are kept rather than de-duplicated: the app lists the same
 * name from two scopes separately (they are different files), and hiding one
 * would make its toggle unreachable.
 */
export declare function listSkills(): Promise<SkillEntry[]>;
/** Enable or disable a skill by its SKILL.md path. */
export declare function setSkillEnabledByPath(skillPath: string, enable: boolean): Promise<void>;
/**
 * Delete a skill directory.
 *
 * Only skills inside a deletable root can go: a plugin's skill belongs to the
 * plugin install and would reappear on the next update, so the API refuses
 * rather than deleting something that comes back. The containment check runs on
 * RESOLVED paths, so a symlinked skill directory cannot point the delete at
 * something outside the roots.
 */
export declare function deleteSkill(skillPath: string): Promise<void>;
/**
 * Copy a skill into the user root.
 *
 * A name collision is refused rather than merged: silently merging two skill
 * directories yields a SKILL.md whose description matches neither original.
 */
export declare function copySkillToUser(skillPath: string): Promise<string>;
export {};
//# sourceMappingURL=skills.d.ts.map