import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveDecisionHeadline,
  deriveDecisionVisualStatus,
  formatPaiseAsInrRupees,
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
  assert.equal(
    deriveDecisionHeadline({
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
    }),
    "₹3,499 recovered",
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
    "Potential duplicate-payment risk prevented",
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
