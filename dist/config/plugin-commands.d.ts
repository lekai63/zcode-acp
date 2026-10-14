/**
 * Plugin command discovery — scans enabled plugins' `commands/*.md`
 * frontmatter to build slash-command entries.
 *
 * `<zcode-home>` is the ZCode data root (`~/.zcode`, or `$ZCODE_HOME` when
 * set — see `zcodeHomeDir()`). Plugin enablement follows the runtime's rule
 * (default-on official plugins included — see plugin-enablement.ts). Plugin
 * commands (e.g. `/code-review`) are resolved by the ZCode backend's
 * `customCommandPromptResolver` before the model sees them, so they work in
 * app-server mode without bridge interception.
 */
/** A slash-command entry compatible with `sendAvailableCommands`. */
export interface PluginCommandEntry {
    name: string;
    description: string;
    input?: {
        hint: string;
    };
}
/**
 * Read enabled plugin commands from the plugin cache + CLI config. Returns
 * entries suitable for `available_commands_update`.
 *
 * Best-effort: failures are logged and swallowed (returns []).
 */
export declare function loadPluginCommands(): PluginCommandEntry[];
//# sourceMappingURL=plugin-commands.d.ts.map