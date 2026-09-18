/**
 * Type definitions for the Ollama Cloud subscription usage feature.
 *
 * `zcode-acp quota` queries the undocumented-but-live
 * `GET https://ollama.com/api/usage` endpoint with the user's API key. The
 * response carries two usage fractions (session = 5h rolling window, weekly =
 * 7d window) in [0, 1] and NO reset timestamps — the server does not expose
 * them, so reset moments are DERIVED client-side (see OcQueryResult) and the
 * card shows them when available.
 *
 * Shape verified against live probes + the pi-multi-account reference client
 * (2026-09); see `.zcode/scratch/research-ollama-cloud-usage.md`. Undocumented
 * — treat parse failures as `unavailable`, never as a crash.
 */
export {};
//# sourceMappingURL=types.js.map