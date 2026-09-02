import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveRecoveryDecisionReceipt } from "./derive-recovery-decision-receipt.ts";

test("receipt is derived from existing Decision, session, Order, and Payments", () => {
  const receipt = deriveRecoveryDecisionReceipt({
    decision: {
      paymentState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
      proposedAction: "REOPEN_CHECKOUT",
      policyResult: "ALLOW",
      policyReason: null,
      executedAction: "REOPEN_CHECKOUT",
      outcome: "RECOVERED",
      recoveredAmount: 349900,
    },
    session: {
      status: "COMPLETED",
      attemptCount: 1,
      originalPaymentId: "pay_internal_failed",
    },
    order: {
      amount: 349900,
      currency: "INR",
      razorpayOrderId: "order_original",
    },
    originalPayment: {
      gatewayStatus: "failed",
      guardianState: "UNSET",
    },
    successfulPayment: {
      gatewayStatus: "captured",
      guardianState: "SUCCESS",
    },
  });

  assert.deepEqual(receipt, {
    decision: {
      paymentState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
      proposedAction: "REOPEN_CHECKOUT",
      policyResult: "ALLOW",
      policyReason: null,
      executedAction: "REOPEN_CHECKOUT",
      outcome: "RECOVERED",
      recoveredAmount: 349900,
    },
    session: {
      status: "COMPLETED",
      attemptCount: 1,
      originalPaymentId: "pay_internal_failed",
    },
    order: {
      amount: 349900,
      currency: "INR",
      razorpayOrderId: "order_original",
    },
    payments: {
      original: {
        gatewayStatus: "failed",
        guardianState: "UNSET",
      },
      recovered: {
        gatewayStatus: "captured",
        guardianState: "SUCCESS",
      },
    },
  });
});
