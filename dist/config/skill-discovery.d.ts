/**
 * Skill discovery — scans the same directories ZCode uses to discover Skills,
 * reads each SKILL.md frontmatter, and returns entries suitable for the ACP
 * `available_commands_update` notification.
 *
 * Each discovered skill becomes its own `/skill-name` slash command in the
 * editor's completion menu (matching Claude Code's behaviour). The model
 * resolves the invocation via its `Skill` tool — the bridge just lists them
 * and passes the text through.
 *
 * Discovery sources (in priority order — first occurrence wins on name clash):
 *   1. <zcode-home>/skills/&#42;/SKILL.md      (user scope, ZCode native)
 *   2. ~/.agents/skills/&#42;/SKILL.md          (user scope, shared agents)
 *   3. enabled plugin <cache>/skills/&#42;/SKILL.md
 *   4. <cwd>/.agents/skills/&#42;/SKILL.md      (project scope)
 *
 * `<zcode-home>` is the ZCode data root (`~/.zcode`, or `$ZCODE_HOME` when
 * set — see `zcodeHomeDir()`). Skills explicitly disabled in
 * `<zcode-home>/cli/config.json` (skills map with `enable: false`, keyed by
 * absolute SKILL.md path) are excluded.
 */
/** A slash-command entry compatible with `sendAvailableCommands`. */
export interface SkillEntry {
    name: string;
    description: string;
    input?: {
        hint: string;
    };
}
/**
 * Discover all enabled skills from the filesystem.
 *
 * Returns entries suitable for `available_commands_update`. Best-effort:
 * failures are logged and swallowed (returns whatever was found).
 */
export declare function loadSkillCommands(): SkillEntry[];
//# sourceMappingURL=skill-discovery.d.ts.map