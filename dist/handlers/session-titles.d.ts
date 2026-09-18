/**
 * Session-scoped `session.titleUpdated` listener (app-server 0.16.5; observed
 * live + schema-verified against the 3.12.3 desktop bundle, 2026-09-18).
 *
 * The backend pushes authoritative conversation-title changes:
 *
 *   { previousTitle, source: "default" | "first_input" | "generated" |
 *     "custom", title, messageID? }
 *
 * The bridge seeds a PROVISIONAL title from the first prompt (session.ts
 * set-once gate) and never consumed the backend's GENERATED title — the title
 * that lands after the first turn ends — so tabs, remote lists, and the
 * tasks-index kept the truncated prompt line forever. This listener adopts
 * the authoritative pushes:
 *
 *   - `generated` — the backend's LLM-generated title; replaces the
 *     provisional seed. A manual user rename still wins: sessions marked in
 *     `server.titleUserSetBy` (the remote rename endpoint marks them) are
 *     left untouched, and the durable `title_overridden` flag in
 *     tasks-index.sqlite is consulted for renames that predate this bridge
 *     process (the in-memory pin does not survive a restart).
 *   - `custom` — a title set by another surface (the desktop app over the
 *     same session store); adopted so every window stays consistent, and
 *     marked user-set so later `generated` pushes cannot override it.
 *   - `default` / `first_input` — nothing to adopt (the bridge already seeds
 *     the first_input form itself from the prompt text).
 *
 * Alias semantics: clients can hold DIFFERENT acpSids for one backend
 * conversation (`server.sessionAliases`) — the pin check, the title maps, and
 * the `session_info_update` broadcast all run over the FULL alias list, never
 * a single last-write-wins id.
 *
 * Best-effort throughout: failures are logged and never thrown into the
 * event loop.
 */
import type { EventListener } from "../backend/client.js";
import type { ZcodeEvent } from "../backend/types.js";
import type { ZcodeAcpServer } from "../server.js";
export declare class SessionTitleListener implements EventListener {
    private readonly server;
    readonly zcodeSid: string;
    constructor(server: ZcodeAcpServer, zcodeSid: string);
    handleEvent(event: ZcodeEvent): void;
    private onTitleUpdated;
}
//# sourceMappingURL=session-titles.d.ts.map