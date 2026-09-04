import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveDecisionHeadline,
  deriveDecisionStory,
  deriveDecisionVisualStatus,
  formatPaiseAsInrRupees,
  humanizeGuardianTerm,
  presentMerchantDashboard,
  summarizeMerchantDashboardMetrics,
} from "./present-merchant-dashboard.ts";

const CREATED_AT = new Date("2026-09-03T10:00:00.000Z");

test("formats persisted paise as INR rupees without inferring extra money", () => {
  assert.equal(formatPaiseAsInrRupees(349900), "₹3,499");
  assert.equal(formatPaiseAsInrRupees(0), "₹0");
  assert.equal(formatPaiseAsInrRupees(-1), "₹0");
  assert.equal(formatPaiseAsInrRupees(100.5), "₹0");
});

test("RECOVERED decision headline uses persisted recoveredAmount only", () => {
  const decision = {
    id: "dec_recovered",
    paymentState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    proposedAction: "REOPEN_CHECKOUT",
    proposalReason: "Card failed at issuer.",
    policyResult: "ALLOW",
    policyReason: null,
    executedAction: "REOPEN_CHECKOUT",
    outcome: "RECOVERED",
    recoveredAmount: 349900,
    createdAt: CREATED_AT,
  };

  assert.equal(deriveDecisionHeadline(decision), "₹3,499 recovered");
  assert.equal(
    deriveDecisionStory(decision),
    "Guardian verified the failure, recommended recovery, merchant policy allowed it, and the payment completed successfully.",
  );
});

test("UNRESOLVED BLOCK CONFIRMED_FAILURE_REQUIRED is duplicate-risk copy", () => {
  assert.equal(
    deriveDecisionHeadline({
      id: "dec_blocked",
      paymentState: "UNRESOLVED",
      failureCategory: null,
      proposedAction: "REOPEN_CHECKOUT",
      proposalReason: null,
      policyResult: "BLOCK",
      policyReason: "CONFIRMED_FAILURE_REQUIRED",
      executedAction: null,
      outcome: null,
      recoveredAmount: null,
      createdAt: CREATED_AT,
    }),
    "Potential duplicate payment prevented",
  );
  assert.equal(
    deriveDecisionVisualStatus({
      id: "dec_blocked",
      paymentState: "UNRESOLVED",
      failureCategory: null,
      proposedAction: "REOPEN_CHECKOUT",
      proposalReason: null,
      policyResult: "BLOCK",
      policyReason: "CONFIRMED_FAILURE_REQUIRED",
      executedAction: null,
      outcome: null,
      recoveredAmount: null,
      createdAt: CREATED_AT,
    }),
    "blocked",
  );
});

test("MAX_ATTEMPTS_REACHED is an unsafe-attempt block, not fraud language", () => {
  const decision = {
    id: "dec_max",
    paymentState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    proposedAction: "REOPEN_CHECKOUT",
    proposalReason: "Reopen checkout.",
    policyResult: "BLOCK",
    policyReason: "MAX_ATTEMPTS_REACHED",
    executedAction: null,
    outcome: null,
    recoveredAmount: null,
    createdAt: CREATED_AT,
  };

  assert.equal(deriveDecisionHeadline(decision), "Unsafe recovery attempt blocked");
  assert.equal(
    deriveDecisionStory(decision),
    "The configured recovery-attempt limit had already been reached.",
  );
  assert.equal(
    humanizeGuardianTerm("MAX_ATTEMPTS_REACHED"),
    "Recovery blocked — maximum safe attempts reached",
  );
});

test("human-readable Guardian terms keep unknown codes unmapped", () => {
  assert.equal(
    humanizeGuardianTerm("GENERIC_PAYMENT_FAILED"),
    "Payment failure confirmed",
  );
  assert.equal(humanizeGuardianTerm("REOPEN_CHECKOUT"), "Reopen checkout safely");
  assert.equal(
    humanizeGuardianTerm("UNRESOLVED"),
    "Previous payment still being verified",
  );
  assert.equal(humanizeGuardianTerm("RECOVERED"), "Payment recovered successfully");
  assert.equal(humanizeGuardianTerm("SOMETHING_NEW"), null);
});

test("success rate uses recovered vs blocked persisted counts only", () => {
  assert.deepEqual(
    summarizeMerchantDashboardMetrics({
      recoveredCount: 1,
      recoveredAmountPaise: 349900,
      blockedCount: 1,
    }),
    {
      revenueRecoveredPaise: 349900,
      recoveriesCompleted: 1,
      unsafeRecoveriesBlocked: 1,
      recoverySuccessRatePercent: 50,
    },
  );
  assert.equal(
    summarizeMerchantDashboardMetrics({
      recoveredCount: 0,
      recoveredAmountPaise: null,
      blockedCount: 0,
    }).recoverySuccessRatePercent,
    null,
  );
});

test("presenter does not invent recovered money from ALLOW without outcome", () => {
  const presented = presentMerchantDashboard({
    recoveredCount: 0,
    recoveredAmountPaise: null,
    blockedCount: 0,
    decisions: [
      {
        id: "dec_open",
        paymentState: "FAILED",
        failureCategory: "GENERIC_PAYMENT_FAILED",
        proposedAction: "REOPEN_CHECKOUT",
        proposalReason: "Reopen checkout.",
        policyResult: "ALLOW",
        policyReason: null,
        executedAction: "REOPEN_CHECKOUT",
        outcome: null,
        recoveredAmount: null,
        createdAt: CREATED_AT,
      },
    ],
  });

  assert.equal(presented.metrics.revenueRecoveredPaise, 0);
  assert.equal(presented.decisions[0]?.headline, "Decision recorded");
  assert.equal(presented.decisions[0]?.visualStatus, "open");
  assert.equal(presented.decisions[0]?.recoveredAmountPaise, null);
});
