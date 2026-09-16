/**
 * Runtime read of the build-time dist content fingerprint
 * (scripts/write-code-fingerprint.mjs → dist/code-fingerprint.json).
 *
 * Null when absent: running from src (dev), or a dist built before the
 * fingerprint step existed — callers must fall back to the legacy
 * version-number comparison then, never treat null as a mismatch.
 */
/** dist/remote/x.js → dist/code-fingerprint.json (dist/ root in tests). */
export declare function codeFingerprintPath(distDir?: string): string;
/** Read the fingerprint; null when the file is missing or malformed. */
export declare function readCodeFingerprint(distDir?: string): string | null;
//# sourceMappingURL=code-fingerprint.d.ts.map