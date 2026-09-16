/**
 * Best-effort POST /api/upgrade poke at the local hub — the "updater owns
 * the restart" half of the staleness design (apt postinst convention): the
 * process that just changed the code on disk tells the running daemon to
 * re-check itself. The hub still makes its own decision (content fingerprint
 * / version / mtime comparison) — this script never forces anything.
 *
 * Run from `pnpm build` (fresh local rebuild) and the npm postinstall hook
 * (a consumer upgrading the package). Every failure is silent by design:
 * no hub running, no token, no remote config — nothing to do, exit 0.
 */
export {};
//# sourceMappingURL=hub-upgrade-notify.d.ts.map