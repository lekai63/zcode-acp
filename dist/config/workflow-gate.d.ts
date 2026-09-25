/**
 * Dynamic-workflow availability gate (desktop-host parity).
 *
 * The desktop's Host utility process decides whether the dynamic-workflow
 * feature (workflow tools, `/workflow` expansion) is available from an
 * ANONYMOUS remote config endpoint — no local toggle, no env override in
 * production (packaged desktop builds strip `ZCODE_DYNAMIC_WORKFLOW_MODE`
 * on purpose). A headless app-server never resolves the gate itself
 * (fail-closed false), so the bridge plays the Host:
 *
 *   GET {origin}/api/v1/client/configs?app_version=&platform=
 *   → data.configs.dynamicWorkflow.mode ∈ disabled|onDemand|alwaysOn
 *   → enabled = mode !== "disabled"
 *
 * Fail-closed everywhere: a missing key, an unknown value, an HTTP error, a
 * fetch throw, or the 6s timeout all read as disabled — a gray-flag read must
 * never block ordinary chat (upstream returns the default verdict on failure
 * for the same reason). The verdict is resolved ONCE per backend spawn
 * (server.backendWorkflowGate, src/server.ts ensureBackend) and pinned to
 * that backend's lifetime; a server-side mode flip becomes visible at the
 * next respawn.
 */
export interface WorkflowGate {
    mode: "disabled" | "onDemand" | "alwaysOn" | "unknown";
    /** mode !== "disabled" — the consumption-side fold (onDemand ≡ alwaysOn today). */
    enabled: boolean;
    /** Observability only: "remote" verdict vs the fail-closed "default". */
    source: "remote" | "default";
}
/**
 * Resolve the gate from the anonymous client-config endpoint. NEVER throws —
 * every failure shape returns the disabled verdict. `fetchImpl` is injectable
 * so tests run without network.
 */
export declare function resolveWorkflowGate(fetchImpl?: typeof fetch): Promise<WorkflowGate>;
/** The gate-bearing half of ZcodeAcpServer (structural, for tests). */
export interface WorkflowGateHolder {
    backendWorkflowGate: Promise<WorkflowGate> | null;
}
/**
 * Attach the settled-value collector at CREATION and return the same promise.
 * Every assignment to `server.backendWorkflowGate` must go through this (the
 * spawn branch of `ensureBackend`) so the verdict is synchronously readable
 * the moment it settles.
 */
export declare function captureGate(promise: Promise<WorkflowGate>): Promise<WorkflowGate>;
/**
 * Belt-and-braces: record the settled value an awaiter just observed. Sites
 * that await `server.backendWorkflowGate` directly (workflowFlag,
 * requireWorkflowEnabled) call this afterwards so a promise created outside
 * `captureGate` still becomes readable without a microtask of delay.
 */
export declare function rememberGate(promise: Promise<WorkflowGate>, value: WorkflowGate): void;
/**
 * Synchronously read the SETTLED gate verdict for the current backend
 * generation: null while the promise is pending or absent (fail-closed —
 * callers treat null as disabled), otherwise the resolved value. The
 * creation-time collector (`captureGate`) keeps this immediate for settled
 * promises; the read-time attach below only covers exotic promises that never
 * went through it.
 */
export declare function workflowGateNow(server: WorkflowGateHolder): WorkflowGate | null;
/**
 * Send-time filter for the advertised `/` menu: the workflow commands ride the
 * static list but must only reach clients when the gate is enabled (the list is
 * built once at startup, so send time is the only reliable filter point).
 * Applied by index.ts at every sendAvailableCommands* call site — the io.ts
 * helpers deliberately take no server.
 */
export declare function filterWorkflowCommands<T extends {
    name: string;
}>(server: WorkflowGateHolder, commands: readonly T[]): T[];
/**
 * Minimal backend surface the policy push needs — structural, so tests can
 * pass a plain fake (the real ZcodeBackend satisfies it).
 */
export interface WorkflowPolicyTarget {
    request(id: number, method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<{
        error?: {
            code?: number | string;
            message?: string;
        };
    }>;
}
/**
 * Push the process-wide dynamic-workflow policy to the backend
 * (`workspace/updateDynamicWorkflowPolicy {enabled:true}`) — the first of the
 * two enable channels (the per-session `dynamicWorkflowEnabled` flag on
 * create/resume is the second; the backend ORs them). The workspace ref is
 * echoed only, never used for lookup — the policy applies to the whole
 * backend process and affects sessions created/resumed AFTER the call
 * (upstream dynamic-workflow-policy.ts). Best-effort: never throws, failures
 * only log — the per-session flag keeps working even when the push lands on
 * an older backend.
 */
export declare function pushDynamicWorkflowPolicy(backend: WorkflowPolicyTarget, nextId: () => number, cwd: string): Promise<void>;
//# sourceMappingURL=workflow-gate.d.ts.map