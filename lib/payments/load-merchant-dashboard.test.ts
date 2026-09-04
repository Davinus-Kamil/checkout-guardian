import assert from "node:assert/strict";
import { test } from "node:test";
import { loadMerchantDashboard } from "./load-merchant-dashboard.ts";
import type { MerchantDashboardDecisionRecord } from "./present-merchant-dashboard.ts";

test("loader maps aggregate persisted Decision facts without inventing money", async () => {
  const createdAt = new Date("2026-09-03T10:00:00.000Z");
  const recovered: MerchantDashboardDecisionRecord = {
    id: "dec_recovered",
    paymentState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    proposedAction: "REOPEN_CHECKOUT",
    proposalReason: "Payment failed due to a bad request error.",
    policyResult: "ALLOW",
    policyReason: null,
    executedAction: "REOPEN_CHECKOUT",
    outcome: "RECOVERED",
    recoveredAmount: 349900,
    createdAt,
  };
  const blocked: MerchantDashboardDecisionRecord = {
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
    createdAt,
  };

  const dashboard = await loadMerchantDashboard({
    decision: {
      async aggregate() {
        return {
          _sum: { recoveredAmount: 349900 },
          _count: { _all: 1 },
        };
      },
      async count() {
        return 1;
      },
      async findMany() {
        return [recovered, blocked];
      },
    },
  });

  assert.equal(dashboard.metrics.revenueRecoveredPaise, 349900);
  assert.equal(dashboard.metrics.recoveriesCompleted, 1);
  assert.equal(dashboard.metrics.unsafeRecoveriesBlocked, 1);
  assert.equal(dashboard.metrics.recoverySuccessRatePercent, 50);
  assert.equal(dashboard.decisions[0]?.headline, "₹3,499 recovered");
  assert.equal(
    dashboard.decisions[1]?.headline,
    "Potential duplicate payment prevented",
  );
  assert.equal(dashboard.decisions[1]?.policyReason, "CONFIRMED_FAILURE_REQUIRED");
});
