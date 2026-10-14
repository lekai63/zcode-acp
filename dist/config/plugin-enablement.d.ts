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
/** An enabled plugin's install root (latest cached version resolved). */
export interface EnabledPluginRoot {
    /** Plugin name (cache directory name — matches the manifest name). */
    name: string;
    /** Plugin root: `<cache>/<marketplace>/<name>/<latest-version>` or the inline dir itself. */
    dir: string;
}
/**
 * Resolve every enabled plugin's install root, marketplace cache first, then
 * inline `plugins.dirs` roots. Official-marketplace plugins enable via the
 * default-on set; everything else needs an explicit `true`.
 */
export declare function loadEnabledPluginRoots(): EnabledPluginRoot[];
//# sourceMappingURL=plugin-enablement.d.ts.map