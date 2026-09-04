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
    <label className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4">
      <span>
        <span className="block text-sm font-medium text-zinc-100">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-zinc-500">
          {description}
        </span>
      </span>
      <span className="flex items-center gap-2 pt-1">
        <span className="text-xs tracking-wide text-zinc-400 uppercase">
          {checked ? "On" : "Off"}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-emerald-400"
        />
      </span>
    </label>
  );
}

function ReadOnlyRow({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-100">{label}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
        <p className="text-xs tracking-wide text-zinc-300 uppercase">{value}</p>
      </div>
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
    <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Recovery Policy</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
        Merchant policy is the final authority. AI can recommend recovery, but
        policy decides whether Guardian may act. AI recommendation is not
        authorization.
      </p>

      {policy === null ? (
        <p className="mt-6 text-sm text-zinc-500">
          No persisted merchant policy yet. Start a checkout to provision the
          demo merchant policy.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          <ToggleRow
            label="Confirmed failure required"
            description="When on, Guardian will not reopen checkout for UNRESOLVED payments."
            checked={requireConfirmedFailure}
            onChange={setRequireConfirmedFailure}
          />
          <label className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4">
            <span>
              <span className="block text-sm font-medium text-zinc-100">
                Maximum recovery attempts
              </span>
              <span className="mt-1 block text-sm leading-6 text-zinc-500">
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
              className="w-20 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-right text-sm text-zinc-100"
            />
          </label>
          <ToggleRow
            label="Alternative payment method allowed"
            description="Stored merchant preference. Recovery execution still only reopens the original checkout."
            checked={allowAlternativeMethod}
            onChange={setAllowAlternativeMethod}
          />
          <ReadOnlyRow
            label="Unknown payment state action"
            value={policy.unknownStateAction}
            description="Read-only in this MVP. Unknown states stay blocked."
          />
          <ReadOnlyRow
            label="Risk failure action"
            value={policy.riskFailureAction}
            description="Read-only in this MVP. Risk failures stay blocked."
          />
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={pending}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium tracking-wide text-zinc-950 uppercase hover:bg-emerald-400 disabled:opacity-50"
            >
              {pending ? "Saving" : "Save policy"}
            </button>
            {status ? (
              <p className="text-sm text-zinc-400">{status}</p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
