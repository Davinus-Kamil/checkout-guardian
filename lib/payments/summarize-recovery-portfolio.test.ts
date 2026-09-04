import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecoveryPortfolioCase } from "./load-recovery-portfolio.ts";
import { summarizeRecoveryPortfolio } from "./summarize-recovery-portfolio.ts";

function portfolioCase(
  overrides: Partial<RecoveryPortfolioCase>,
): RecoveryPortfolioCase {
  return {
    recoverySessionId: "rsess_1",
    orderId: "ord_1",
    originalPaymentId: "pay_original_1",
    latestDecisionId: "dec_1",
    amountPaise: 349900,
    classification: "RECOVERABLE",
    sessionStatus: "OPEN",
    paymentState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    policyResult: "ALLOW",
    policyReason: null,
    outcome: null,
    recoveredAmountPaise: null,
    attemptCount: 0,
    ...overrides,
  };
}

test("A. one RECOVERABLE 349900 case -> revenue at risk and recoverable value", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({ classification: "RECOVERABLE", amountPaise: 349900 }),
  ]);

  assert.equal(summary.totalCases, 1);
  assert.equal(summary.recoverableCases, 1);
  assert.equal(summary.revenueAtRiskPaise, 349900);
  assert.equal(summary.recoverableValuePaise, 349900);
  assert.equal(summary.recoveredRevenuePaise, 0);
  assert.equal(summary.heldEscalatedValuePaise, 0);
  assert.equal(summary.stoppedValuePaise, 0);
});

test("B. one HOLD_ESCALATE 349900 -> revenue at risk and held escalated value", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({
      classification: "HOLD_ESCALATE",
      amountPaise: 349900,
      paymentState: "UNRESOLVED",
      policyResult: "BLOCK",
      policyReason: "CONFIRMED_FAILURE_REQUIRED",
    }),
  ]);

  assert.equal(summary.heldEscalatedCases, 1);
  assert.equal(summary.revenueAtRiskPaise, 349900);
  assert.equal(summary.heldEscalatedValuePaise, 349900);
  assert.equal(summary.recoverableValuePaise, 0);
  assert.equal(summary.recoveredRevenuePaise, 0);
});

test("C. RECOVERED uses recoveredAmount only; current risk is 0", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({
      classification: "RECOVERED",
      amountPaise: 349900,
      recoveredAmountPaise: 349900,
      sessionStatus: "COMPLETED",
      outcome: "RECOVERED",
    }),
  ]);

  assert.equal(summary.recoveredCases, 1);
  assert.equal(summary.recoveredRevenuePaise, 349900);
  assert.equal(summary.revenueAtRiskPaise, 0);
  assert.equal(summary.recoverableValuePaise, 0);
  assert.equal(summary.stoppedValuePaise, 0);
});

test("D. RECOVERED with different recoveredAmount uses persisted recoveredAmount only", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({
      classification: "RECOVERED",
      amountPaise: 349900,
      recoveredAmountPaise: 1200,
      sessionStatus: "COMPLETED",
      outcome: "RECOVERED",
    }),
  ]);

  assert.equal(summary.recoveredRevenuePaise, 1200);
  assert.notEqual(summary.recoveredRevenuePaise, 349900);
  assert.equal(summary.revenueAtRiskPaise, 0);
});

test("E. STOPPED contributes stopped value but not current risk or recovered revenue", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({
      classification: "STOPPED",
      amountPaise: 349900,
      policyResult: "BLOCK",
      policyReason: "MAX_ATTEMPTS_REACHED",
    }),
  ]);

  assert.equal(summary.stoppedCases, 1);
  assert.equal(summary.stoppedValuePaise, 349900);
  assert.equal(summary.revenueAtRiskPaise, 0);
  assert.equal(summary.recoveredRevenuePaise, 0);
});

test("F. mixed portfolio correctly sums all four classifications", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({
      recoverySessionId: "rsess_recoverable",
      classification: "RECOVERABLE",
      amountPaise: 10000,
    }),
    portfolioCase({
      recoverySessionId: "rsess_hold",
      classification: "HOLD_ESCALATE",
      amountPaise: 20000,
    }),
    portfolioCase({
      recoverySessionId: "rsess_recovered",
      classification: "RECOVERED",
      amountPaise: 349900,
      recoveredAmountPaise: 5000,
    }),
    portfolioCase({
      recoverySessionId: "rsess_stopped",
      classification: "STOPPED",
      amountPaise: 40000,
    }),
  ]);

  assert.equal(summary.totalCases, 4);
  assert.equal(summary.recoverableCases, 1);
  assert.equal(summary.heldEscalatedCases, 1);
  assert.equal(summary.recoveredCases, 1);
  assert.equal(summary.stoppedCases, 1);
  assert.equal(summary.recoverableValuePaise, 10000);
  assert.equal(summary.heldEscalatedValuePaise, 20000);
  assert.equal(summary.recoveredRevenuePaise, 5000);
  assert.equal(summary.stoppedValuePaise, 40000);
  assert.equal(summary.revenueAtRiskPaise, 30000);
});

test("G. recoveredAmount null/zero/invalid never becomes recovered revenue", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({
      classification: "RECOVERED",
      amountPaise: 349900,
      recoveredAmountPaise: null,
    }),
    portfolioCase({
      classification: "RECOVERED",
      amountPaise: 349900,
      recoveredAmountPaise: 0,
    }),
    portfolioCase({
      classification: "RECOVERED",
      amountPaise: 349900,
      recoveredAmountPaise: 12.5 as unknown as number,
    }),
    portfolioCase({
      classification: "RECOVERED",
      amountPaise: 349900,
      recoveredAmountPaise: -100 as unknown as number,
    }),
  ]);

  assert.equal(summary.recoveredCases, 4);
  assert.equal(summary.recoveredRevenuePaise, 0);
  assert.equal(summary.revenueAtRiskPaise, 0);
});

test("H. malformed/negative/non-integer case amount contributes no financial value", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({
      classification: "RECOVERABLE",
      amountPaise: -349900 as unknown as number,
    }),
    portfolioCase({
      classification: "HOLD_ESCALATE",
      amountPaise: 100.5 as unknown as number,
    }),
    portfolioCase({
      classification: "STOPPED",
      amountPaise: Number.NaN,
    }),
  ]);

  assert.equal(summary.revenueAtRiskPaise, 0);
  assert.equal(summary.recoverableValuePaise, 0);
  assert.equal(summary.heldEscalatedValuePaise, 0);
  assert.equal(summary.stoppedValuePaise, 0);
  assert.equal(summary.recoveredRevenuePaise, 0);
});

test("I. counts remain classification-based even when malformed money contributes zero value", () => {
  const summary = summarizeRecoveryPortfolio([
    portfolioCase({
      classification: "RECOVERABLE",
      amountPaise: -1 as unknown as number,
    }),
    portfolioCase({
      classification: "HOLD_ESCALATE",
      amountPaise: 1.25 as unknown as number,
    }),
    portfolioCase({
      classification: "RECOVERED",
      amountPaise: 349900,
      recoveredAmountPaise: null,
    }),
    portfolioCase({
      classification: "STOPPED",
      amountPaise: Number.POSITIVE_INFINITY as unknown as number,
    }),
  ]);

  assert.equal(summary.totalCases, 4);
  assert.equal(summary.recoverableCases, 1);
  assert.equal(summary.heldEscalatedCases, 1);
  assert.equal(summary.recoveredCases, 1);
  assert.equal(summary.stoppedCases, 1);
  assert.equal(summary.revenueAtRiskPaise, 0);
  assert.equal(summary.recoveredRevenuePaise, 0);
});

test("J. input array/cases are not mutated", () => {
  const original: RecoveryPortfolioCase = portfolioCase({
    classification: "RECOVERABLE",
    amountPaise: 349900,
  });
  const cases = Object.freeze([Object.freeze(original)]);
  const snapshot = structuredClone(original);

  summarizeRecoveryPortfolio(cases);

  assert.deepEqual(cases[0], snapshot);
  assert.equal(cases.length, 1);
});
