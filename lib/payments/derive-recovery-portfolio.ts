export type RecoveryPortfolioClassification =
  | "RECOVERABLE"
  | "HOLD_ESCALATE"
  | "STOPPED"
  | "RECOVERED";

export type RecoveryPortfolioFacts = {
  sessionStatus: string;
  paymentState: string;
  failureCategory: string | null;
  policyResult: string | null;
  policyReason: string | null;
  outcome: string | null;
  recoveredAmount: number | null;
  attemptCount: number;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isCompletedRecovery(facts: RecoveryPortfolioFacts): boolean {
  return (
    facts.outcome === "RECOVERED" &&
    facts.sessionStatus === "COMPLETED" &&
    isPositiveInteger(facts.recoveredAmount)
  );
}

function isTerminalStop(facts: RecoveryPortfolioFacts): boolean {
  return (
    facts.policyResult === "BLOCK" &&
    facts.policyReason === "MAX_ATTEMPTS_REACHED"
  );
}

function isAuthorizedConfirmedFailure(facts: RecoveryPortfolioFacts): boolean {
  return (
    facts.paymentState === "FAILED" &&
    facts.failureCategory === "GENERIC_PAYMENT_FAILED" &&
    facts.policyResult === "ALLOW" &&
    facts.policyReason === null &&
    facts.outcome === null &&
    (facts.sessionStatus === "OPEN" || facts.sessionStatus === "IN_PROGRESS") &&
    isNonNegativeInteger(facts.attemptCount)
  );
}

export function deriveRecoveryPortfolioClassification(
  facts: RecoveryPortfolioFacts,
): RecoveryPortfolioClassification {
  if (isCompletedRecovery(facts)) {
    return "RECOVERED";
  }

  if (isTerminalStop(facts) || facts.paymentState === "SUCCESS") {
    return "STOPPED";
  }

  if (isAuthorizedConfirmedFailure(facts)) {
    return "RECOVERABLE";
  }

  return "HOLD_ESCALATE";
}
