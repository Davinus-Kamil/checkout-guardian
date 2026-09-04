import type { RecoveryPortfolioCase } from "./load-recovery-portfolio.ts";

export type RecoveryPortfolioSummary = {
  totalCases: number;
  revenueAtRiskPaise: number;
  recoverableValuePaise: number;
  recoveredRevenuePaise: number;
  heldEscalatedValuePaise: number;
  stoppedValuePaise: number;
  recoverableCases: number;
  recoveredCases: number;
  heldEscalatedCases: number;
  stoppedCases: number;
};

function nonNegativeIntegerPaise(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  return 0;
}

function positiveIntegerPaise(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  return 0;
}

export function emptyRecoveryPortfolioSummary(): RecoveryPortfolioSummary {
  return {
    totalCases: 0,
    revenueAtRiskPaise: 0,
    recoverableValuePaise: 0,
    recoveredRevenuePaise: 0,
    heldEscalatedValuePaise: 0,
    stoppedValuePaise: 0,
    recoverableCases: 0,
    recoveredCases: 0,
    heldEscalatedCases: 0,
    stoppedCases: 0,
  };
}

export function summarizeRecoveryPortfolio(
  cases: readonly RecoveryPortfolioCase[],
): RecoveryPortfolioSummary {
  const summary = emptyRecoveryPortfolioSummary();

  for (const portfolioCase of cases) {
    summary.totalCases += 1;

    const amountPaise = nonNegativeIntegerPaise(portfolioCase.amountPaise);

    switch (portfolioCase.classification) {
      case "RECOVERABLE":
        summary.recoverableCases += 1;
        summary.recoverableValuePaise += amountPaise;
        summary.revenueAtRiskPaise += amountPaise;
        break;
      case "HOLD_ESCALATE":
        summary.heldEscalatedCases += 1;
        summary.heldEscalatedValuePaise += amountPaise;
        summary.revenueAtRiskPaise += amountPaise;
        break;
      case "RECOVERED":
        summary.recoveredCases += 1;
        summary.recoveredRevenuePaise += positiveIntegerPaise(
          portfolioCase.recoveredAmountPaise,
        );
        break;
      case "STOPPED":
        summary.stoppedCases += 1;
        summary.stoppedValuePaise += amountPaise;
        break;
    }
  }

  return summary;
}
