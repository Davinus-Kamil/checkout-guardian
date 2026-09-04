import assert from "node:assert/strict";
import { test } from "node:test";
import { enrichRecoveryPortfolioForDemo } from "./enrich-recovery-portfolio-for-demo.ts";
import type { RecoveryPortfolioCase } from "./load-recovery-portfolio.ts";

function portfolioCase(
  overrides: Partial<RecoveryPortfolioCase>,
): RecoveryPortfolioCase {
  return {
    recoverySessionId: "rsess_real_1",
    orderId: "ord_real_1",
    originalPaymentId: "pay_real_1",
    latestDecisionId: "dec_real_1",
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

function classificationsOf(cases: RecoveryPortfolioCase[]) {
  return cases.map((portfolioCase) => portfolioCase.classification);
}

test("A. empty input adds RECOVERABLE, HOLD_ESCALATE, STOPPED only", () => {
  const enriched = enrichRecoveryPortfolioForDemo([]);

  assert.deepEqual(classificationsOf(enriched), [
    "RECOVERABLE",
    "HOLD_ESCALATE",
    "STOPPED",
  ]);
  assert.equal(enriched.length, 3);
});

test("B. never adds RECOVERED", () => {
  const empty = enrichRecoveryPortfolioForDemo([]);
  const withRecovered = enrichRecoveryPortfolioForDemo([
    portfolioCase({
      classification: "RECOVERED",
      sessionStatus: "COMPLETED",
      outcome: "RECOVERED",
      recoveredAmountPaise: 349900,
    }),
  ]);

  assert.equal(
    empty.some((portfolioCase) => portfolioCase.classification === "RECOVERED"),
    false,
  );
  assert.equal(
    withRecovered.filter((portfolioCase) => portfolioCase.classification === "RECOVERED")
      .length,
    1,
  );
});

test("C. existing RECOVERABLE prevents duplicate controlled RECOVERABLE", () => {
  const real = portfolioCase({ classification: "RECOVERABLE" });
  const enriched = enrichRecoveryPortfolioForDemo([real]);

  assert.equal(
    enriched.filter((portfolioCase) => portfolioCase.classification === "RECOVERABLE")
      .length,
    1,
  );
  assert.equal(enriched[0], real);
});

test("D. existing HOLD_ESCALATE prevents duplicate hold", () => {
  const real = portfolioCase({
    classification: "HOLD_ESCALATE",
    paymentState: "UNRESOLVED",
    policyResult: "BLOCK",
    policyReason: "CONFIRMED_FAILURE_REQUIRED",
  });
  const enriched = enrichRecoveryPortfolioForDemo([real]);

  assert.equal(
    enriched.filter((portfolioCase) => portfolioCase.classification === "HOLD_ESCALATE")
      .length,
    1,
  );
});

test("E. existing STOPPED prevents duplicate stop", () => {
  const real = portfolioCase({
    classification: "STOPPED",
    policyResult: "BLOCK",
    policyReason: "MAX_ATTEMPTS_REACHED",
    attemptCount: 1,
  });
  const enriched = enrichRecoveryPortfolioForDemo([real]);

  assert.equal(
    enriched.filter((portfolioCase) => portfolioCase.classification === "STOPPED")
      .length,
    1,
  );
});

test("F. existing RECOVERED remains untouched", () => {
  const recovered = portfolioCase({
    recoverySessionId: "rsess_recovered",
    classification: "RECOVERED",
    sessionStatus: "COMPLETED",
    outcome: "RECOVERED",
    recoveredAmountPaise: 349900,
  });
  const snapshot = structuredClone(recovered);
  const enriched = enrichRecoveryPortfolioForDemo([recovered]);

  assert.equal(enriched[0], recovered);
  assert.deepEqual(enriched[0], snapshot);
  assert.equal(enriched[0]?.recoveredAmountPaise, 349900);
});

test("G. real cases remain first and unchanged", () => {
  const first = portfolioCase({ recoverySessionId: "rsess_a" });
  const second = portfolioCase({
    recoverySessionId: "rsess_b",
    classification: "RECOVERED",
    sessionStatus: "COMPLETED",
    outcome: "RECOVERED",
    recoveredAmountPaise: 1200,
  });
  const enriched = enrichRecoveryPortfolioForDemo([first, second]);

  assert.equal(enriched[0], first);
  assert.equal(enriched[1], second);
  assert.equal(enriched[0]?.recoverySessionId, "rsess_a");
  assert.equal(enriched[1]?.recoverySessionId, "rsess_b");
});

test("H. controlled IDs are clearly demo-prefixed", () => {
  const enriched = enrichRecoveryPortfolioForDemo([]);

  for (const portfolioCase of enriched) {
    assert.equal(portfolioCase.recoverySessionId.startsWith("demo_"), true);
    assert.equal(portfolioCase.orderId.startsWith("demo_"), true);
    assert.equal(portfolioCase.originalPaymentId.startsWith("demo_"), true);
    assert.equal(portfolioCase.latestDecisionId, null);
  }

  assert.equal(enriched[0]?.recoverySessionId, "demo_controlled_recoverable");
  assert.equal(enriched[1]?.recoverySessionId, "demo_controlled_hold_escalate");
  assert.equal(enriched[2]?.recoverySessionId, "demo_controlled_stopped");
});

test("I. controlled recoveredAmountPaise is always null", () => {
  const enriched = enrichRecoveryPortfolioForDemo([]);

  for (const portfolioCase of enriched) {
    assert.equal(portfolioCase.recoveredAmountPaise, null);
  }
});

test("J. input not mutated", () => {
  const original = portfolioCase({
    classification: "RECOVERED",
    recoveredAmountPaise: 349900,
  });
  const cases = Object.freeze([Object.freeze(original)]);
  const snapshot = structuredClone(original);

  enrichRecoveryPortfolioForDemo(cases);

  assert.equal(cases.length, 1);
  assert.deepEqual(cases[0], snapshot);
});

test("K. calling enrichment twice does not grow the set further", () => {
  const once = enrichRecoveryPortfolioForDemo([]);
  const twice = enrichRecoveryPortfolioForDemo(once);

  assert.equal(once.length, 3);
  assert.equal(twice.length, 3);
  assert.deepEqual(classificationsOf(twice), classificationsOf(once));
});
