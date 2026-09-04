"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type RecoveryPolicyPanelPolicy = {
  requireConfirmedFailure: boolean;
  maxRecoveryAttempts: number;
  allowAlternativeMethod: boolean;
  unknownStateAction: string;
  riskFailureAction: string;
};

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 ${
        checked ? "bg-slate-900" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400">{checked ? "On" : "Off"}</span>
        <Switch checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

function GuardrailRow({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-slate-500" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 1.75A2.75 2.75 0 0 0 5.25 4.5V6H4.5A1.5 1.5 0 0 0 3 7.5v5A1.5 1.5 0 0 0 4.5 14h7A1.5 1.5 0 0 0 13 12.5v-5A1.5 1.5 0 0 0 11.5 6h-.75V4.5A2.75 2.75 0 0 0 8 1.75Zm1.25 4.25h-2.5V4.5a1.25 1.25 0 1 1 2.5 0v1.5Z"
            />
          </svg>
          {label}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <p className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold tracking-wide text-rose-800 ring-1 ring-rose-100">
        {value}
      </p>
    </div>
  );
}

export default function RecoveryPolicyPanel({
  policy,
}: {
  policy: RecoveryPolicyPanelPolicy | null;
}) {
  const router = useRouter();
  const [requireConfirmedFailure, setRequireConfirmedFailure] = useState(
    policy?.requireConfirmedFailure ?? true,
  );
  const [maxRecoveryAttempts, setMaxRecoveryAttempts] = useState(
    policy?.maxRecoveryAttempts ?? 1,
  );
  const [allowAlternativeMethod, setAllowAlternativeMethod] = useState(
    policy?.allowAlternativeMethod ?? true,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/dashboard/policy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requireConfirmedFailure,
          maxRecoveryAttempts,
          allowAlternativeMethod,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (
        !payload ||
        typeof payload !== "object" ||
        !("ok" in payload) ||
        payload.ok !== true
      ) {
        setStatus("Policy was not updated. Merchant policy remains unchanged.");
        return;
      }

      setStatus("Policy saved. Guardian will use this on the next recovery gate.");
      router.refresh();
    } catch {
      setStatus("Policy was not updated. Merchant policy remains unchanged.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="recovery-policy"
      className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recovery Policy</h2>
          <p className="mt-0.5 text-sm font-medium text-slate-800">
            Merchant policy is the final authorization boundary.
          </p>
        </div>
      </div>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
        AI can recommend recovery. Merchant policy decides whether Guardian may
        act. Recommendation is not authorization, and execution happens only
        after policy ALLOW.
      </p>

      {policy === null ? (
        <p className="mt-4 text-sm text-slate-500">
          No persisted merchant policy yet. Start a checkout to provision the
          demo merchant policy.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wide text-slate-400">
              Autonomy controls
            </p>
            <div className="space-y-2">
              <ToggleRow
                label="Confirmed failure required"
                description="When on, Guardian will not reopen checkout for UNRESOLVED payments."
                checked={requireConfirmedFailure}
                onChange={setRequireConfirmedFailure}
              />
              <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    Maximum recovery attempts
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                    Bounded 0–3. Enforced by deterministic merchant policy, not AI.
                  </span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={3}
                  step={1}
                  value={maxRecoveryAttempts}
                  onChange={(event) =>
                    setMaxRecoveryAttempts(Number(event.target.value))
                  }
                  className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                />
              </label>
              <ToggleRow
                label="Alternative payment method allowed"
                description="Stored merchant preference. Recovery execution still only reopens the original checkout."
                checked={allowAlternativeMethod}
                onChange={setAllowAlternativeMethod}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wide text-slate-400">
              Safety guardrails
            </p>
            <div className="space-y-2">
              <GuardrailRow
                label="Unknown payment state"
                value={policy.unknownStateAction}
                description="Read-only in this MVP. Unknown states stay blocked."
              />
              <GuardrailRow
                label="Risk failure"
                value={policy.riskFailureAction}
                description="Read-only in this MVP. Risk failures stay blocked."
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={pending}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
            >
              {pending ? "Saving" : "Save policy"}
            </button>
            {status ? (
              <p className="text-xs text-slate-600">{status}</p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
