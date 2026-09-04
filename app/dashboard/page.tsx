import Link from "next/link";
import RecoveryPolicyPanel, {
  type RecoveryPolicyPanelPolicy,
} from "./recovery-policy-panel";
import { loadMerchantDashboard } from "@/lib/payments/load-merchant-dashboard";
import { loadMerchantPolicy } from "@/lib/payments/load-merchant-policy";
import {
  formatPaiseAsInrRupees,
  type PresentedMerchantDashboard,
  type PresentedMerchantDashboardDecision,
} from "@/lib/payments/present-merchant-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Checkout Guardian | Merchant Dashboard",
  description:
    "State-aware payment recovery with merchant-governed safety.",
};

function formatWhen(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClass(status: PresentedMerchantDashboardDecision["visualStatus"]) {
  if (status === "recovered") {
    return "border-emerald-400/40 bg-emerald-500/10";
  }

  if (status === "blocked") {
    return "border-rose-400/40 bg-rose-500/10";
  }

  return "border-zinc-700 bg-zinc-900/80";
}

function statusLabel(status: PresentedMerchantDashboardDecision["visualStatus"]) {
  if (status === "recovered") {
    return "Recovered";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Open";
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <p className="text-xs font-medium tracking-[0.18em] text-zinc-400 uppercase">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{hint}</p>
    </article>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.16em] text-zinc-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm break-words text-zinc-200">
        {value && value.trim() ? value : "—"}
      </dd>
    </div>
  );
}

function DecisionCard({
  decision,
}: {
  decision: PresentedMerchantDashboardDecision;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 ${statusClass(decision.visualStatus)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{decision.headline}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {formatWhen(decision.createdAtIso)}
          </p>
        </div>
        <span className="rounded-full border border-zinc-500/30 px-3 py-1 text-xs tracking-wide uppercase">
          {statusLabel(decision.visualStatus)}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Payment state" value={decision.paymentState} />
        <Fact label="Failure category" value={decision.failureCategory} />
        <Fact label="Proposed action" value={decision.proposedAction} />
        <Fact label="AI advisory" value={decision.proposalReason} />
        <Fact label="Policy result" value={decision.policyResult} />
        <Fact label="Policy reason" value={decision.policyReason} />
        <Fact label="Executed action" value={decision.executedAction} />
        <Fact label="Outcome" value={decision.outcome} />
        <Fact
          label="Recovered amount"
          value={
            decision.outcome === "RECOVERED" &&
            typeof decision.recoveredAmountPaise === "number"
              ? formatPaiseAsInrRupees(decision.recoveredAmountPaise)
              : null
          }
        />
      </dl>
    </article>
  );
}

function DashboardBody({
  dashboard,
  policy,
}: {
  dashboard: PresentedMerchantDashboard;
  policy: RecoveryPolicyPanelPolicy | null;
}) {
  const { metrics } = dashboard;

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-emerald-400 uppercase">
              Checkout Guardian
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Payment failed. Checkout didn’t.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              State-aware payment recovery with merchant-governed safety.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-zinc-700 px-4 py-2 text-xs tracking-wide text-zinc-300 uppercase hover:border-zinc-500"
          >
            Back to storefront
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Revenue Recovered"
            value={formatPaiseAsInrRupees(metrics.revenueRecoveredPaise)}
            hint="Sum of persisted recoveredAmount on RECOVERED decisions."
          />
          <MetricCard
            label="Recoveries Completed"
            value={String(metrics.recoveriesCompleted)}
            hint="Decisions with outcome RECOVERED."
          />
          <MetricCard
            label="Unsafe Recoveries Blocked"
            value={String(metrics.unsafeRecoveriesBlocked)}
            hint="Decisions with policyResult BLOCK."
          />
          <MetricCard
            label="Recovery Success Rate"
            value={
              metrics.recoverySuccessRatePercent === null
                ? "—"
                : `${metrics.recoverySuccessRatePercent}%`
            }
            hint="Recovered ÷ (recovered + blocked)."
          />
        </section>

        <RecoveryPolicyPanel policy={policy} />

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Recent Guardian decisions
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Latest persisted Decision records. Read-only audit trail.
              </p>
            </div>
          </div>

          {dashboard.decisions.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-8 text-sm text-zinc-400">
              No Guardian decisions yet.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {dashboard.decisions.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default async function MerchantDashboardPage() {
  const [dashboard, policyResult] = await Promise.all([
    loadMerchantDashboard(),
    loadMerchantPolicy(),
  ]);

  const policy = policyResult.ok
    ? {
        requireConfirmedFailure: policyResult.policy.requireConfirmedFailure,
        maxRecoveryAttempts: policyResult.policy.maxRecoveryAttempts,
        allowAlternativeMethod: policyResult.policy.allowAlternativeMethod,
        unknownStateAction: policyResult.policy.unknownStateAction,
        riskFailureAction: policyResult.policy.riskFailureAction,
      }
    : null;

  return <DashboardBody dashboard={dashboard} policy={policy} />;
}
