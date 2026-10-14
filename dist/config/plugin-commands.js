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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { loadEnabledPluginRoots } from "./plugin-enablement.js";
import { log } from "../utils.js";
/** Parse YAML-like frontmatter from a plugin command .md file. */
function parseFrontmatter(content) {
    const fm = {};
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match)
        return fm;
    const lines = match[1].split(/\r?\n/);
    for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx <= 0)
            continue;
        const key = line.slice(0, idx).trim();
        // Strip surrounding quotes from the value (YAML scalar style).
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (key)
            fm[key] = val;
    }
    return fm;
}
/**
 * Read enabled plugin commands from the plugin cache + CLI config. Returns
 * entries suitable for `available_commands_update`.
 *
 * Best-effort: failures are logged and swallowed (returns []).
 */
export function loadPluginCommands() {
    const entries = [];
    try {
        for (const plugin of loadEnabledPluginRoots()) {
            const commandsDir = path.join(plugin.dir, "commands");
            if (!existsSync(commandsDir))
                continue;
            for (const file of readdirSync(commandsDir)) {
                if (!file.endsWith(".md"))
                    continue;
                const cmdPath = path.join(commandsDir, file);
                const content = readFileSync(cmdPath, "utf8");
                const fm = parseFrontmatter(content);
                const name = file.replace(/\.md$/, "");
                const description = fm["description"] ?? "";
                if (!description)
                    continue;
                const entry = { name, description };
                const hint = fm["argument-hint"];
                if (hint)
                    entry.input = { hint };
                entries.push(entry);
            }
        }
        log(`plugin-commands: loaded ${entries.length} plugin command(s)`);
        return entries;
    }
    catch (e) {
        log(`plugin-commands: load failed (${e instanceof Error ? e.message : String(e)})`);
        return [];
    }
}
//# sourceMappingURL=plugin-commands.js.map