import type { RecoveryPortfolioCase } from "./load-recovery-portfolio.ts";

const AURALIS_AMOUNT_PAISE = 349900;

const CONTROLLED_RECOVERABLE: RecoveryPortfolioCase = {
  recoverySessionId: "demo_controlled_recoverable",
  orderId: "demo_order_recoverable",
  originalPaymentId: "demo_payment_recoverable",
  latestDecisionId: null,
  amountPaise: AURALIS_AMOUNT_PAISE,
  classification: "RECOVERABLE",
  sessionStatus: "OPEN",
  paymentState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
  policyResult: "ALLOW",
  policyReason: null,
  outcome: null,
  recoveredAmountPaise: null,
  attemptCount: 0,
};

const CONTROLLED_HOLD_ESCALATE: RecoveryPortfolioCase = {
  recoverySessionId: "demo_controlled_hold_escalate",
  orderId: "demo_order_hold_escalate",
  originalPaymentId: "demo_payment_hold_escalate",
  latestDecisionId: null,
  amountPaise: AURALIS_AMOUNT_PAISE,
  classification: "HOLD_ESCALATE",
  sessionStatus: "OPEN",
  paymentState: "UNRESOLVED",
  failureCategory: null,
  policyResult: "BLOCK",
  policyReason: "CONFIRMED_FAILURE_REQUIRED",
  outcome: null,
  recoveredAmountPaise: null,
  attemptCount: 0,
};

const CONTROLLED_STOPPED: RecoveryPortfolioCase = {
  recoverySessionId: "demo_controlled_stopped",
  orderId: "demo_order_stopped",
  originalPaymentId: "demo_payment_stopped",
  latestDecisionId: null,
  amountPaise: AURALIS_AMOUNT_PAISE,
  classification: "STOPPED",
  sessionStatus: "OPEN",
  paymentState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
  policyResult: "BLOCK",
  policyReason: "MAX_ATTEMPTS_REACHED",
  outcome: null,
  recoveredAmountPaise: null,
  attemptCount: 1,
};

const CONTROLLED_COVERAGE = [
  CONTROLLED_RECOVERABLE,
  CONTROLLED_HOLD_ESCALATE,
  CONTROLLED_STOPPED,
] as const;

export function enrichRecoveryPortfolioForDemo(
  cases: readonly RecoveryPortfolioCase[],
): RecoveryPortfolioCase[] {
  const present = new Set(cases.map((portfolioCase) => portfolioCase.classification));
  const extras = CONTROLLED_COVERAGE.filter(
    (controlled) => !present.has(controlled.classification),
  );

  return [...cases, ...extras.map((controlled) => ({ ...controlled }))];
}
