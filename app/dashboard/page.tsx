import Link from "next/link";
import RecoveryPolicyPanel, {
  type RecoveryPolicyPanelPolicy,
} from "./recovery-policy-panel";
import { loadMerchantDashboard } from "@/lib/payments/load-merchant-dashboard";
import { loadMerchantPolicy } from "@/lib/payments/load-merchant-policy";
import { enrichRecoveryPortfolioForDemo } from "@/lib/payments/enrich-recovery-portfolio-for-demo";
import {
  loadRecoveryPortfolio,
  type RecoveryPortfolioCase,
} from "@/lib/payments/load-recovery-portfolio";
import {
  formatPaiseAsInrRupees,
  humanizeGuardianTerm,
  type PresentedMerchantDashboard,
  type PresentedMerchantDashboardDecision,
} from "@/lib/payments/present-merchant-dashboard";
import {
  summarizeRecoveryPortfolio,
  type RecoveryPortfolioSummary,
} from "@/lib/payments/summarize-recovery-portfolio";

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

function statusLabel(status: PresentedMerchantDashboardDecision["visualStatus"]) {
  if (status === "recovered") {
    return "Recovered";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Open";
}

function portfolioStatusLabel(
  classification: RecoveryPortfolioCase["classification"],
): string {
  if (classification === "RECOVERABLE") {
    return "Ready for safe recovery";
  }

  if (classification === "HOLD_ESCALATE") {
    return "Hold / escalate";
  }

  if (classification === "STOPPED") {
    return "Recovery stopped";
  }

  return "Revenue recovered";
}

function isControlledDemoCase(portfolioCase: RecoveryPortfolioCase): boolean {
  return portfolioCase.recoverySessionId.startsWith("demo_controlled_");
}

function recoveredAmountDisplay(amountPaise: number | null): string | null {
  if (
    typeof amountPaise === "number" &&
    Number.isInteger(amountPaise) &&
    amountPaise > 0
  ) {
    return formatPaiseAsInrRupees(amountPaise);
  }

  return null;
}

function shortenId(id: string): string {
  if (id.length <= 14) {
    return id;
  }

  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function displayTerm(value: string | null): string {
  const human = humanizeGuardianTerm(value);
  if (human) {
    return human;
  }

  return value && value.trim() ? value : "—";
}

function Icon({
  d,
  className = "h-4 w-4",
}: {
  d: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path fill="currentColor" d={d} />
    </svg>
  );
}

const ICONS = {
  shield:
    "M8 1.25 2.5 3.5v4.2c0 3.3 2.2 5.7 5.5 6.95C11.3 13.4 13.5 11 13.5 7.7V3.5L8 1.25Z",
  grid: "M2.5 2.5h4.5v4.5H2.5V2.5Zm6.5 0H13.5v4.5H9V2.5ZM2.5 9H7v4.5H2.5V9ZM9 9h4.5v4.5H9V9Z",
  layers:
    "M8 1.5 1.75 5 8 8.5 14.25 5 8 1.5ZM2.4 8.1 1.75 8.5 8 12l6.25-3.5-.65-.4L8 10.9 2.4 8.1ZM2.4 11.1 1.75 11.5 8 15l6.25-3.5-.65-.4L8 13.9 2.4 11.1Z",
  receipt:
    "M3.5 1.5h9v13l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1v-13Zm2 3h5v1.2h-5V4.5Zm0 2.5h5V8.2h-5V7Zm0 2.5h3.5V10.7H5.5V9.5Z",
  sliders:
    "M7 2.25v1.8H2.5V5.3H7v1.8h1.5V5.3H13.5V4.05H8.5v-1.8H7Zm-4.5 7.2v1.25H7.5v1.8H9v-1.8h4.5V9.45H9v-1.8H7.5v1.8H2.5Z",
  store:
    "M2 5.5 3.2 2.5h9.6L14 5.5V7a2 2 0 0 1-2 2v4.5H4V9A2 2 0 0 1 2 7V5.5Zm2.5 8h7V9.9A3 3 0 0 1 10 10a3 3 0 0 1-2-.7A3 3 0 0 1 6 10a3 3 0 0 1-1.5-.4V13.5Z",
  check:
    "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.03 4.22-3.5 4.5a.75.75 0 0 1-1.12.07l-1.75-1.75 1.06-1.06 1.14 1.14 2.99-3.84 1.18.94Z",
  arrow:
    "M8.75 2.5v7.19L6.03 6.97 4.97 8.03l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5-1.06-1.06-2.72 2.72V2.5h-1.5Z",
  pause:
    "M5.25 3h1.5v10h-1.5V3Zm4 0h1.5v10H9.25V3Z",
  stop: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM5.5 7.25h5v1.5h-5v-1.5Z",
  warn: "M8 1.75 14.5 14.25H1.5L8 1.75ZM8 6.2v3.3h.01V6.2H8Zm0 5.3a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z",
  info: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 7h1.5v4.25h-1.5V7ZM8 4.4a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7Z",
  lock: "M8 1.75A2.75 2.75 0 0 0 5.25 4.5V6H4.5A1.5 1.5 0 0 0 3 7.5v5A1.5 1.5 0 0 0 4.5 14h7A1.5 1.5 0 0 0 13 12.5v-5A1.5 1.5 0 0 0 11.5 6h-.75V4.5A2.75 2.75 0 0 0 8 1.75Zm1.25 4.25h-2.5V4.5a1.25 1.25 0 1 1 2.5 0v1.5Z",
};

function NavItem({
  href,
  label,
  icon,
  current = false,
}: {
  href: string;
  label: string;
  icon: string;
  current?: boolean;
}) {
  const className = `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
    current
      ? "bg-white/10 text-white"
      : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;
  const content = (
    <>
      <Icon d={icon} className="h-3.5 w-3.5 shrink-0 opacity-80" />
      {label}
    </>
  );

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {content}
    </a>
  );
}

function DashboardSidebar() {
  return (
    <aside className="border-b border-slate-800 bg-[#0f172a] text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-slate-800">
      <div className="flex items-start gap-3 px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30">
          <Icon d={ICONS.shield} className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">
            Checkout Guardian
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
            Recover revenue. Protect trust.
          </p>
        </div>
      </div>
      <nav
        aria-label="Merchant dashboard"
        className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible"
      >
        <p className="mb-1 hidden px-2 text-[10px] font-medium tracking-wide text-slate-500 lg:block">
          Overview
        </p>
        <NavItem href="#dashboard" label="Dashboard" icon={ICONS.grid} current />
        <NavItem
          href="#recovery-portfolio"
          label="Recovery Portfolio"
          icon={ICONS.layers}
        />
        <p className="mb-1 mt-3 hidden px-2 text-[10px] font-medium tracking-wide text-slate-500 lg:block">
          Control
        </p>
        <NavItem
          href="#decision-receipts"
          label="Decision Receipts"
          icon={ICONS.receipt}
        />
        <NavItem
          href="#recovery-policy"
          label="Recovery Policy"
          icon={ICONS.sliders}
        />
        <NavItem href="/" label="Auralis Store" icon={ICONS.store} />
      </nav>
      <div className="hidden border-t border-slate-800 p-3 lg:block">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg bg-slate-800/80 px-3 py-2.5 outline-none ring-1 ring-slate-700 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-200">
            AU
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white">Auralis</span>
            <span className="block text-[11px] text-slate-400">
              Merchant account
            </span>
          </span>
          <span className="text-slate-500" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </aside>
  );
}

function MetricIcon({
  kind,
}: {
  kind: "risk" | "recoverable" | "recovered" | "hold" | "stopped";
}) {
  if (kind === "recovered") {
    return <Icon d={ICONS.check} />;
  }

  if (kind === "recoverable") {
    return <Icon d={ICONS.arrow} />;
  }

  if (kind === "hold") {
    return <Icon d={ICONS.pause} />;
  }

  if (kind === "stopped") {
    return <Icon d={ICONS.stop} />;
  }

  return <Icon d={ICONS.warn} />;
}

const METRIC_THEME = {
  risk: {
    bar: "bg-amber-400",
    icon: "bg-amber-50 text-amber-700",
  },
  recoverable: {
    bar: "bg-indigo-500",
    icon: "bg-indigo-50 text-indigo-700",
  },
  recovered: {
    bar: "bg-emerald-500",
    icon: "bg-emerald-50 text-emerald-700",
  },
  hold: {
    bar: "bg-orange-400",
    icon: "bg-orange-50 text-orange-700",
  },
  stopped: {
    bar: "bg-rose-500",
    icon: "bg-rose-50 text-rose-700",
  },
} as const;

function PortfolioMetricCard({
  label,
  value,
  hint,
  kind,
}: {
  label: string;
  value: string;
  hint: string;
  kind: keyof typeof METRIC_THEME;
}) {
  const theme = METRIC_THEME[kind];

  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${theme.bar}`} />
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${theme.icon}`}
        >
          <MetricIcon kind={kind} />
        </span>
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-2.5 text-[1.35rem] font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{hint}</p>
    </article>
  );
}

function statusTone(status: PresentedMerchantDashboardDecision["visualStatus"]) {
  if (status === "recovered") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }

  if (status === "blocked") {
    return "bg-rose-50 text-rose-800 ring-rose-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function decisionPath(decision: PresentedMerchantDashboardDecision): string {
  const recovered = recoveredAmountDisplay(decision.recoveredAmountPaise);
  const state = displayTerm(decision.paymentState);

  if (decision.outcome === "RECOVERED" && recovered) {
    return `${state} → Authorized → Recovered ${recovered}`;
  }

  if (
    decision.policyResult === "BLOCK" &&
    decision.paymentState === "UNRESOLVED"
  ) {
    return "UNRESOLVED → Policy BLOCK → No checkout";
  }

  if (decision.policyResult === "BLOCK") {
    return `${state} → Policy BLOCK → No execution`;
  }

  if (decision.executedAction) {
    return `${state} → Authorized → ${displayTerm(decision.executedAction)}`;
  }

  return `${state} → ${displayTerm(decision.policyResult)} → ${displayTerm(decision.outcome)}`;
}

function AuditFact({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const human = displayTerm(value);
  const raw = value && value.trim() && humanizeGuardianTerm(value) ? value : null;

  return (
    <span className="inline-flex max-w-full items-baseline gap-1">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="truncate text-[11px] text-slate-700">{human}</span>
      {raw ? (
        <span className="hidden font-mono text-[10px] text-slate-400 sm:inline">
          {raw}
        </span>
      ) : null}
    </span>
  );
}

function DecisionRow({
  decision,
}: {
  decision: PresentedMerchantDashboardDecision;
}) {
  const recoveredDisplay =
    decision.outcome === "RECOVERED"
      ? recoveredAmountDisplay(decision.recoveredAmountPaise)
      : null;

  return (
    <article className="relative border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50/80">
      <span className="absolute top-4 left-0 h-2 w-2 -translate-x-1/2 rounded-full bg-slate-300" />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{decision.headline}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
            {decisionPath(decision)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">
            {formatWhen(decision.createdAtIso)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusTone(decision.visualStatus)}`}
          >
            {statusLabel(decision.visualStatus)}
          </span>
        </div>
      </div>
      {decision.story ? (
        <p className="mt-1 text-xs leading-5 text-slate-600">{decision.story}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <AuditFact label="State" value={decision.paymentState} />
        <AuditFact label="AI" value={decision.proposalReason ?? decision.proposedAction} />
        <AuditFact label="Policy" value={decision.policyResult} />
        <AuditFact label="Reason" value={decision.policyReason} />
        <AuditFact label="Executed" value={decision.executedAction} />
        <AuditFact label="Outcome" value={decision.outcome} />
        <AuditFact
          label="Recovered"
          value={recoveredDisplay ?? (decision.outcome === "RECOVERED" ? "—" : null)}
        />
        <AuditFact label="Failure" value={decision.failureCategory} />
      </div>
    </article>
  );
}

function classificationAccent(
  classification: RecoveryPortfolioCase["classification"],
): string {
  if (classification === "RECOVERED") {
    return "border-l-emerald-500";
  }

  if (classification === "RECOVERABLE") {
    return "border-l-indigo-500";
  }

  if (classification === "HOLD_ESCALATE") {
    return "border-l-amber-500";
  }

  return "border-l-rose-500";
}

function classificationIconWrap(
  classification: RecoveryPortfolioCase["classification"],
): string {
  if (classification === "RECOVERED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (classification === "RECOVERABLE") {
    return "bg-indigo-50 text-indigo-700";
  }

  if (classification === "HOLD_ESCALATE") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

function PortfolioCaseRow({
  portfolioCase,
  zebra,
}: {
  portfolioCase: RecoveryPortfolioCase;
  zebra: boolean;
}) {
  const controlled = isControlledDemoCase(portfolioCase);
  const recovered = recoveredAmountDisplay(portfolioCase.recoveredAmountPaise);
  const policyLine = [
    displayTerm(portfolioCase.policyResult),
    portfolioCase.policyReason
      ? displayTerm(portfolioCase.policyReason)
      : null,
  ]
    .filter((part): part is string => Boolean(part && part !== "—"))
    .join(" · ");

  return (
    <article
      className={`border-b border-slate-100 border-l-4 px-4 py-2.5 last:border-b-0 hover:bg-slate-50 ${classificationAccent(portfolioCase.classification)} ${zebra ? "bg-slate-50/60" : "bg-white"}`}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(13rem,1.3fr)_minmax(6.5rem,0.85fr)_minmax(6.5rem,0.85fr)_minmax(5.5rem,0.65fr)_minmax(8.5rem,1.05fr)_minmax(5.5rem,0.65fr)_minmax(7.5rem,0.75fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${classificationIconWrap(portfolioCase.classification)}`}
          >
            <MetricIcon
              kind={
                portfolioCase.classification === "RECOVERED"
                  ? "recovered"
                  : portfolioCase.classification === "RECOVERABLE"
                    ? "recoverable"
                    : portfolioCase.classification === "HOLD_ESCALATE"
                      ? "hold"
                      : "stopped"
              }
            />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              {portfolioStatusLabel(portfolioCase.classification)}
            </p>
            <span
              className={`mt-0.5 inline-flex rounded px-1.5 py-px text-[10px] font-medium ${
                controlled
                  ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
                  : "text-slate-400"
              }`}
            >
              {controlled ? "Controlled demo case" : "Persisted recovery case"}
            </span>
          </div>
        </div>
        <p className="min-w-0">
          <span className="block text-[10px] text-slate-400 lg:hidden">Order</span>
          <span
            className="block truncate font-mono text-xs text-slate-600"
            title={portfolioCase.orderId}
          >
            {shortenId(portfolioCase.orderId)}
          </span>
        </p>
        <p className="min-w-0">
          <span className="block text-[10px] text-slate-400 lg:hidden">Payment</span>
          <span
            className="block truncate font-mono text-xs text-slate-600"
            title={portfolioCase.originalPaymentId}
          >
            {shortenId(portfolioCase.originalPaymentId)}
          </span>
        </p>
        <p className="text-sm font-semibold tabular-nums text-slate-900">
          <span className="block text-[10px] font-normal text-slate-400 lg:hidden">
            Amount
          </span>
          {formatPaiseAsInrRupees(portfolioCase.amountPaise)}
        </p>
        <p className="min-w-0 text-xs text-slate-700">
          <span className="block text-[10px] text-slate-400 lg:hidden">
            Policy / reason
          </span>
          {policyLine || "—"}
        </p>
        <p className="text-sm font-semibold tabular-nums text-slate-900">
          <span className="block text-[10px] font-normal text-slate-400 lg:hidden">
            Recovered
          </span>
          {recovered ?? "—"}
        </p>
        <div>
          {!controlled && portfolioCase.latestDecisionId ? (
            <Link
              href={`/api/decisions/${portfolioCase.latestDecisionId}/receipt`}
              className="inline-flex rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              View receipt
            </Link>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>
      </div>
    </article>
  );
}

function RevenueRecoveryPortfolio({
  cases,
  summary,
}: {
  cases: RecoveryPortfolioCase[];
  summary: RecoveryPortfolioSummary;
}) {
  const pills = [
    { label: "All cases", count: summary.totalCases, dot: "bg-slate-400" },
    { label: "Recoverable", count: summary.recoverableCases, dot: "bg-indigo-500" },
    { label: "Recovered", count: summary.recoveredCases, dot: "bg-emerald-500" },
    { label: "Hold / escalate", count: summary.heldEscalatedCases, dot: "bg-amber-500" },
    { label: "Stopped", count: summary.stoppedCases, dot: "bg-rose-500" },
  ];

  return (
    <section id="recovery-portfolio" className="scroll-mt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Revenue Recovery Portfolio
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-slate-600">
            Verify what is truly unpaid, recover what is safe, hold uncertainty,
            and stop unnecessary payment attempts.
          </p>
        </div>
        <a
          href="#how-guardian-works"
          className="text-xs font-medium text-slate-500 outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          How Guardian works
        </a>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <PortfolioMetricCard
          kind="risk"
          label="Revenue at Risk"
          value={formatPaiseAsInrRupees(summary.revenueAtRiskPaise)}
          hint={`${summary.recoverableCases + summary.heldEscalatedCases} cases needing recovery or hold`}
        />
        <PortfolioMetricCard
          kind="recoverable"
          label="Recoverable Value"
          value={formatPaiseAsInrRupees(summary.recoverableValuePaise)}
          hint={`${summary.recoverableCases} recoverable cases`}
        />
        <PortfolioMetricCard
          kind="recovered"
          label="Revenue Recovered"
          value={formatPaiseAsInrRupees(summary.recoveredRevenuePaise)}
          hint={`${summary.recoveredCases} recovered cases`}
        />
        <PortfolioMetricCard
          kind="hold"
          label="Held / Escalated"
          value={formatPaiseAsInrRupees(summary.heldEscalatedValuePaise)}
          hint={`${summary.heldEscalatedCases} held / escalated cases`}
        />
        <PortfolioMetricCard
          kind="stopped"
          label="Recovery Stopped"
          value={formatPaiseAsInrRupees(summary.stoppedValuePaise)}
          hint={`${summary.stoppedCases} stopped cases`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {pills.map((pill) => (
          <span
            key={pill.label}
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
            {pill.label}
            <span className="tabular-nums text-slate-400">{pill.count}</span>
          </span>
        ))}
      </div>

      <div className="mt-3 flex gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
        <Icon d={ICONS.info} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
        <p>
          Controlled demo cases show Guardian’s decision boundaries when that
          state is absent from the current persisted test data. They do not
          contribute to financial metrics or recovered revenue.
        </p>
      </div>

      {cases.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          No persisted recovery cases yet.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden border-b border-slate-100 bg-slate-50/80 px-4 py-1.5 text-[10px] font-medium tracking-wide text-slate-400 lg:grid lg:grid-cols-[minmax(13rem,1.3fr)_minmax(6.5rem,0.85fr)_minmax(6.5rem,0.85fr)_minmax(5.5rem,0.65fr)_minmax(8.5rem,1.05fr)_minmax(5.5rem,0.65fr)_minmax(7.5rem,0.75fr)]">
            <span>Status</span>
            <span>Order</span>
            <span>Payment</span>
            <span>Amount</span>
            <span>Policy / reason</span>
            <span>Recovered</span>
            <span>Action</span>
          </div>
          {cases.map((portfolioCase, index) => (
            <PortfolioCaseRow
              key={portfolioCase.recoverySessionId}
              portfolioCase={portfolioCase}
              zebra={index % 2 === 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GuardianPipeline() {
  const steps = [
    {
      title: "Observe",
      kicker: null,
      body: "Capture the failed checkout attempt.",
      highlight: false,
    },
    {
      title: "Verify",
      kicker: "Payment truth",
      body: "Razorpay + deterministic server.",
      highlight: true,
    },
    {
      title: "Diagnose",
      kicker: null,
      body: "Classify only confirmed failure facts.",
      highlight: false,
    },
    {
      title: "Recommend",
      kicker: "AI advisory",
      body: "Gemini recommends only.",
      highlight: true,
    },
    {
      title: "Gate",
      kicker: "Authorization",
      body: "Merchant policy decides.",
      highlight: true,
    },
    {
      title: "Recover",
      kicker: null,
      body: "Reopen checkout only after ALLOW.",
      highlight: false,
    },
    {
      title: "Audit",
      kicker: null,
      body: "Persist the full Decision receipt.",
      highlight: false,
    },
  ];

  return (
    <section
      id="how-guardian-works"
      className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Guardian decision pipeline
        </h2>
        <p className="text-xs text-slate-500">
          AI recommends. Policy authorizes.
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Razorpay and deterministic server logic establish payment truth. AI
        remains advisory. Execution happens only after merchant policy ALLOW.
      </p>
      <ol className="mt-4 flex flex-col gap-0 lg:flex-row lg:items-stretch">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex flex-1">
            <div
              className={`flex-1 rounded-lg px-2.5 py-2.5 ${
                step.highlight
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-800"
              }`}
            >
              <p
                className={`text-[10px] font-semibold tracking-wide ${step.highlight ? "text-sky-300" : "text-slate-400"}`}
              >
                {index + 1} {step.title}
              </p>
              {step.kicker ? (
                <p
                  className={`mt-0.5 text-[11px] font-medium ${step.highlight ? "text-white" : "text-slate-700"}`}
                >
                  {step.kicker}
                </p>
              ) : null}
              <p
                className={`mt-0.5 text-[11px] leading-4 ${step.highlight ? "text-slate-300" : "text-slate-500"}`}
              >
                {step.body}
              </p>
            </div>
            {index < steps.length - 1 ? (
              <span
                className="hidden shrink-0 self-center px-0.5 text-slate-300 lg:block"
                aria-hidden="true"
              >
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function DashboardBody({
  dashboard,
  policy,
  portfolioCases,
  portfolioSummary,
}: {
  dashboard: PresentedMerchantDashboard;
  policy: RecoveryPolicyPanelPolicy | null;
  portfolioCases: RecoveryPortfolioCase[];
  portfolioSummary: RecoveryPortfolioSummary;
}) {
  const { metrics } = dashboard;
  const openCases =
    portfolioSummary.recoverableCases + portfolioSummary.heldEscalatedCases;

  return (
    <div id="dashboard" className="min-h-full bg-[#f4f7fb] text-slate-900">
      <div className="lg:flex lg:min-h-full">
        <DashboardSidebar />
        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200/80 bg-white/90">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-7">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                    Good morning, Auralis
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Guardian active
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">
                  Here’s how Checkout Guardian is protecting your payment revenue.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-right">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    {formatPaiseAsInrRupees(portfolioSummary.recoveredRevenuePaise)}{" "}
                    recovered
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {openCases} cases currently need recovery or hold
                  </p>
                </div>
                <p className="hidden text-xs text-slate-400 sm:block">
                  AI recommends. Merchant policy authorizes.
                </p>
              </div>
            </div>
          </header>

          <main className="space-y-5 px-5 py-4 sm:px-7 sm:py-5">
            <RevenueRecoveryPortfolio
              cases={portfolioCases}
              summary={portfolioSummary}
            />

            <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  Historical recovery performance
                </h2>
                <p className="text-[11px] text-slate-500">
                  Aggregate persisted recovery-decision totals — distinct from the
                  current session-level portfolio above.
                </p>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 xl:grid-cols-4">
                <div>
                  <dt className="text-[10px] text-slate-400">
                    Persisted recovered revenue
                  </dt>
                  <dd className="text-sm font-semibold text-slate-800">
                    {formatPaiseAsInrRupees(metrics.revenueRecoveredPaise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-slate-400">Completed recoveries</dt>
                  <dd className="text-sm font-semibold text-slate-800">
                    {metrics.recoveriesCompleted}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-slate-400">
                    Unsafe recoveries blocked
                  </dt>
                  <dd className="text-sm font-semibold text-slate-800">
                    {metrics.unsafeRecoveriesBlocked}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-slate-400">Recovery success rate</dt>
                  <dd className="text-sm font-semibold text-slate-800">
                    {metrics.recoverySuccessRatePercent === null
                      ? "—"
                      : `${metrics.recoverySuccessRatePercent}%`}
                  </dd>
                </div>
              </dl>
            </section>

            <GuardianPipeline />
            <RecoveryPolicyPanel policy={policy} />

            <section
              id="decision-receipts"
              className="scroll-mt-4 rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Recent Guardian decisions
                </h2>
                <p className="text-xs text-slate-500">
                  Latest persisted decisions. Every Guardian action is auditable.
                </p>
              </div>
              {dashboard.decisions.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">
                  No Guardian decisions yet.
                </p>
              ) : (
                <div className="relative ml-4 border-l border-slate-200">
                  {dashboard.decisions.map((decision) => (
                    <DecisionRow key={decision.id} decision={decision} />
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default async function MerchantDashboardPage() {
  const [dashboard, policyResult, persistedPortfolio] = await Promise.all([
    loadMerchantDashboard(),
    loadMerchantPolicy(),
    loadRecoveryPortfolio(),
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

  const summary = summarizeRecoveryPortfolio(persistedPortfolio);
  const displayPortfolio = enrichRecoveryPortfolioForDemo(persistedPortfolio);

  return (
    <DashboardBody
      dashboard={dashboard}
      policy={policy}
      portfolioCases={displayPortfolio}
      portfolioSummary={summary}
    />
  );
}
