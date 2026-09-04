export const MERCHANT_DASHBOARD_RECENT_LIMIT = 20;

export type MerchantDashboardDecisionRecord = {
  id: string;
  paymentState: string;
  failureCategory: string | null;
  proposedAction: string;
  proposalReason: string | null;
  policyResult: string | null;
  policyReason: string | null;
  executedAction: string | null;
  outcome: string | null;
  recoveredAmount: number | null;
  createdAt: Date;
};

export type MerchantDashboardVisualStatus =
  | "recovered"
  | "blocked"
  | "open";

export type PresentedMerchantDashboardDecision = {
  id: string;
  paymentState: string;
  failureCategory: string | null;
  proposedAction: string;
  proposalReason: string | null;
  policyResult: string | null;
  policyReason: string | null;
  executedAction: string | null;
  outcome: string | null;
  recoveredAmountPaise: number | null;
  createdAtIso: string;
  headline: string;
  visualStatus: MerchantDashboardVisualStatus;
};

export type PresentedMerchantDashboardMetrics = {
  revenueRecoveredPaise: number;
  recoveriesCompleted: number;
  unsafeRecoveriesBlocked: number;
  recoverySuccessRatePercent: number | null;
};

export type PresentedMerchantDashboard = {
  metrics: PresentedMerchantDashboardMetrics;
  decisions: PresentedMerchantDashboardDecision[];
};

export function formatPaiseAsInrRupees(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) {
    return "₹0";
  }

  const rupees = paise / 100;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

export function deriveDecisionHeadline(
  decision: MerchantDashboardDecisionRecord,
): string {
  if (
    decision.outcome === "RECOVERED" &&
    typeof decision.recoveredAmount === "number" &&
    Number.isInteger(decision.recoveredAmount) &&
    decision.recoveredAmount > 0
  ) {
    return `${formatPaiseAsInrRupees(decision.recoveredAmount)} recovered`;
  }

  if (
    decision.paymentState === "UNRESOLVED" &&
    decision.policyResult === "BLOCK" &&
    decision.policyReason === "CONFIRMED_FAILURE_REQUIRED"
  ) {
    return "Potential duplicate-payment risk prevented";
  }

  if (decision.policyResult === "BLOCK") {
    return "Recovery blocked by merchant policy";
  }

  return "Decision recorded";
}

export function deriveDecisionVisualStatus(
  decision: MerchantDashboardDecisionRecord,
): MerchantDashboardVisualStatus {
  if (decision.outcome === "RECOVERED") {
    return "recovered";
  }

  if (decision.policyResult === "BLOCK") {
    return "blocked";
  }

  return "open";
}

export function summarizeMerchantDashboardMetrics(input: {
  recoveredCount: number;
  recoveredAmountPaise: number | null;
  blockedCount: number;
}): PresentedMerchantDashboardMetrics {
  const recoveriesCompleted =
    Number.isInteger(input.recoveredCount) && input.recoveredCount > 0
      ? input.recoveredCount
      : 0;
  const unsafeRecoveriesBlocked =
    Number.isInteger(input.blockedCount) && input.blockedCount > 0
      ? input.blockedCount
      : 0;
  const revenueRecoveredPaise =
    typeof input.recoveredAmountPaise === "number" &&
    Number.isInteger(input.recoveredAmountPaise) &&
    input.recoveredAmountPaise > 0
      ? input.recoveredAmountPaise
      : 0;
  const decided = recoveriesCompleted + unsafeRecoveriesBlocked;

  return {
    revenueRecoveredPaise,
    recoveriesCompleted,
    unsafeRecoveriesBlocked,
    recoverySuccessRatePercent:
      decided === 0
        ? null
        : Math.round((recoveriesCompleted / decided) * 100),
  };
}

export function presentMerchantDashboardDecision(
  decision: MerchantDashboardDecisionRecord,
): PresentedMerchantDashboardDecision {
  return {
    id: decision.id,
    paymentState: decision.paymentState,
    failureCategory: decision.failureCategory,
    proposedAction: decision.proposedAction,
    proposalReason: decision.proposalReason,
    policyResult: decision.policyResult,
    policyReason: decision.policyReason,
    executedAction: decision.executedAction,
    outcome: decision.outcome,
    recoveredAmountPaise:
      typeof decision.recoveredAmount === "number" &&
      Number.isInteger(decision.recoveredAmount)
        ? decision.recoveredAmount
        : null,
    createdAtIso: decision.createdAt.toISOString(),
    headline: deriveDecisionHeadline(decision),
    visualStatus: deriveDecisionVisualStatus(decision),
  };
}

export function presentMerchantDashboard(input: {
  recoveredCount: number;
  recoveredAmountPaise: number | null;
  blockedCount: number;
  decisions: MerchantDashboardDecisionRecord[];
}): PresentedMerchantDashboard {
  return {
    metrics: summarizeMerchantDashboardMetrics(input),
    decisions: input.decisions.map(presentMerchantDashboardDecision),
  };
}

export function emptyMerchantDashboard(): PresentedMerchantDashboard {
  return presentMerchantDashboard({
    recoveredCount: 0,
    recoveredAmountPaise: 0,
    blockedCount: 0,
    decisions: [],
  });
}
