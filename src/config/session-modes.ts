/**
 * Session modes the bridge offers. ZCode's mode enum also has `auto`, but it
 * is reserved and unimplemented — the runtime's permission service denies
 * every tool call in it ("mode.auto.unimplemented") — so it is never
 * advertised nor accepted from /mode, session/set_mode, or the user config.
 *
 * Leaf module (no imports): user-config/settings cannot import utils without
 * closing a cycle, and all of them need this list.
 */
export const SESSION_MODES = ["plan", "build", "edit", "yolo"] as const;

export type SessionMode = (typeof SESSION_MODES)[number];

export function isSessionMode(mode: unknown): mode is SessionMode {
  return typeof mode === "string" && (SESSION_MODES as readonly string[]).includes(mode);
}
