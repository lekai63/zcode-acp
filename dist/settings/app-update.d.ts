/**
 * ZCode desktop app self-update.
 *
 * The desktop app updates itself through Electron's autoUpdater, which needs an
 * Electron runtime this process does not have. The parts that DO work headless
 * are the ones that decide WHAT to install: the release manifest
 * (`/api/v1/releases/electron/manifest`), the platform/arch/channel spelling,
 * and the CDN download. So this module reproduces those and hands the actual
 * install back to the OS.
 *
 * Whether the bundle can be swapped is PROBED, never assumed (see
 * `canWriteInstallLocation`): the obvious reading of `/Applications`'s
 * `drwxrwxr-x root:admin` is that an admin user cannot write it, yet the
 * installed `ZCode.app` is user-owned on the machine this was written for — so
 * the code branches on `accessSync` and is correct either way, and no claim is
 * made about which branch a given install takes. What is deliberately NOT done
 * is privileged escalation (a password prompt, a Finder Apple Event, a shipped
 * privileged helper): a long-lived daemon has no good place to ask, and the
 * one-shot confirmation macOS raises when a user drags a bundle into place is
 * already the right amount of trust.
 *
 * What the flow does NOT do is silently swap a running app. The app is replaced
 * on disk while it may be running, and the user is told to quit and reopen —
 * attempting to kill the app from here would be both rude and unsafe (it may
 * have an in-flight session whose state lives in the app process).
 */
import { rename } from "node:fs/promises";
/** Channel → the API's numeric spelling (manifestUpdateProvider.ts:41-42). */
declare const CHANNEL_VALUES: {
    readonly stable: 1;
    readonly preview: 3;
};
export type ReleaseChannel = keyof typeof CHANNEL_VALUES;
/** Node platform → the manifest's spelling (manifestUpdateProvider.ts:57-68). */
export declare function releasePlatform(platform: NodeJS.Platform, arch: string): string;
/** One downloadable artifact the manifest offers. */
export interface ReleaseFile {
    url: string;
    sha512?: string;
    size?: number;
}
export interface ReleaseManifest {
    version: string;
    releaseName?: string;
    releaseNotes?: string;
    releaseNotesByLocale?: Record<string, {
        title?: string;
        markdown?: string;
    }>;
    files: ReleaseFile[];
    /** The single-artifact fallback electron-updater uses when no arch matches. */
    path?: string;
}
export interface UpdateCheck {
    /** True when the manifest offers a strictly newer version. */
    updateAvailable: boolean;
    currentVersion: string | null;
    latestVersion: string | null;
    channel: ReleaseChannel;
    platform: string;
    /** Populated only when an update is available. */
    release?: ReleaseManifest;
}
/**
 * Where the app is installed, or null when it is not found.
 *
 * `ZCODE_APP_PATH` overrides the whole lookup so a test (or a non-standard
 * install) can point somewhere safe. The candidate list mirrors the table in
 * `backend/resolve.ts`: /Applications first, then the per-user location, then
 * the Linux prefixes.
 */
export declare function appBundlePath(env?: NodeJS.ProcessEnv): string | null;
/**
 * The installed app's version, read from its bundle.
 *
 * macOS: `CFBundleShortVersionString` out of `Info.plist`, parsed without a
 * plist library (the file is XML for these builds; a binary plist falls back to
 * `defaults read`, which handles both). Windows: the file version of the .exe.
 * Linux: null — there is no reliable in-bundle version.
 */
export declare function installedAppVersion(appPath: string, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform): Promise<string | null>;
/**
 * Compare two version strings numerically, segment by segment.
 *
 * Local on purpose: `utils.compareVersions` is fine for semver-ish strings but
 * the manifest can carry a build suffix (`3.14.1.7714`), and comparing
 * `7714` against a missing segment must not flip the result.
 */
export declare function isNewerVersion(candidate: string, current: string): boolean;
/**
 * Parse the manifest YAML.
 *
 * The manifest is a small, fixed-shape document (version + files + release
 * notes), so a real YAML parser would be a dependency for no benefit. This
 * reader handles exactly the shapes the endpoint emits: a flat top level, a
 * `files:` list of mappings, and the `releaseNotesByLocale` nesting. Block
 * scalars (`|-`) are collected by indentation.
 *
 * Anything it does not understand throws rather than guessing — a misparsed
 * manifest would install the wrong build.
 */
export declare function parseManifest(raw: string): ReleaseManifest;
/**
 * Pick the artifact to download for this platform.
 *
 * macOS prefers the zip (it extracts to a bundle directly and needs no mount);
 * Windows takes the exe; Linux takes the distro package. Falls back to the
 * manifest's top-level `path`, which is what electron-updater itself uses when
 * no per-arch entry matches.
 */
export declare function pickReleaseFile(manifest: ReleaseManifest): ReleaseFile | null;
/**
 * Fetch and parse the release manifest.
 *
 * `fetchImpl` defaults to the module seam (not bare `fetch`) so a test that
 * overrides the network also covers this path, not just `checkForAppUpdate`.
 */
export declare function fetchReleaseManifest(channel: ReleaseChannel, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): Promise<ReleaseManifest>;
/** Override the update network. Pass `fetch` to restore the default. */
export declare function setManifestNetworkForTest(impl: typeof fetch): void;
/** Override the platform the update flows run as (test seam). */
export declare function setAppUpdatePlatformForTest(platform: NodeJS.Platform): void;
/**
 * Compare the installed app against the manifest.
 *
 * A missing install (the bridge running on a machine without the app) is not an
 * error: `updateAvailable` stays false and `currentVersion` is null, so the
 * client can hide the row instead of showing a failure.
 */
export declare function checkForAppUpdate(options?: {
    channel?: ReleaseChannel;
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
}): Promise<UpdateCheck>;
export interface DownloadProgress {
    receivedBytes: number;
    totalBytes: number | null;
}
export interface DownloadResult {
    file: string;
    sha512: string;
    sizeBytes: number;
    /** True when the hash matched the manifest's `sha512`. */
    verified: boolean;
}
/**
 * Download an artifact into a temp directory, streaming and hashing as it goes.
 *
 * The hash is verified before anything is installed: a truncated or tampered
 * download that failed here is a failed download, not a bad install.
 *
 * The body is consumed as a web `ReadableStream` (what `fetch` returns), not a
 * Node stream — `pipe` does not exist on it.
 */
export declare function downloadRelease(file: ReleaseFile, options?: {
    destDir?: string;
    fetchImpl?: typeof fetch;
    onProgress?: (p: DownloadProgress) => void;
}): Promise<DownloadResult>;
export type InstallStage = "idle" | "downloading" | "installing" | "done" | "needs-user-install" | "failed";
export interface InstallState {
    stage: InstallStage;
    version: string | null;
    receivedBytes: number;
    totalBytes: number | null;
    /**
     * Where the verified bundle is, for `needs-user-install`. The client shows
     * this path (or reveals it in Finder) so the user can finish the install
     * themselves.
     */
    artifactPath?: string;
    /** True on `done`: the new build is on disk and the app must be reopened. */
    restartRequired?: boolean;
    error?: string;
}
/** Current install state — the endpoint reports it verbatim. */
export declare function appUpdateState(): InstallState;
/** Override the unzip used by the installer (test seam). */
export declare function setExtractForTest(impl: (zipPath: string, destDir: string) => Promise<void>): void;
/** Restore the platform's own unzip (test seam). */
export declare function resetExtractForTest(): void;
/** Override the rename used by the installer (test seam). */
export declare function setInstallRenameForTest(impl: typeof rename): void;
export declare function startAppUpdate(file: ReleaseFile, version: string, options?: {
    channel?: ReleaseChannel;
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    fetchImpl?: typeof fetch;
}): Promise<InstallState>;
/** Clear the stored install state (test seam). */
export declare function resetAppUpdateStateForTest(): void;
export {};
//# sourceMappingURL=app-update.d.ts.map