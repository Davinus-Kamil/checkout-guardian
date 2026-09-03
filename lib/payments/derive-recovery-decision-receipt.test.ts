import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveRecoveryDecisionReceipt } from "./derive-recovery-decision-receipt.ts";

const DECISION_CREATED_AT = new Date("2026-09-02T10:00:00.000Z");
const SESSION_CREATED_AT = new Date("2026-09-02T09:59:00.000Z");
const SESSION_UPDATED_AT = new Date("2026-09-02T10:05:00.000Z");
const ORDER_CREATED_AT = new Date("2026-09-02T09:50:00.000Z");
const ORDER_UPDATED_AT = new Date("2026-09-02T10:05:00.000Z");
const ORIGINAL_CREATED_AT = new Date("2026-09-02T09:55:00.000Z");
const ORIGINAL_UPDATED_AT = new Date("2026-09-02T09:56:00.000Z");
const RECOVERED_CREATED_AT = new Date("2026-09-02T10:04:00.000Z");
const RECOVERED_UPDATED_AT = new Date("2026-09-02T10:05:00.000Z");

test("A. recovered Decision Receipt preserves authoritative audit facts", () => {
  const receipt = deriveRecoveryDecisionReceipt({
    decision: {
      id: "dec_recovered",
      recoverySessionId: "rsess_recovered",
      paymentId: "pay_internal_failed",
      paymentState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
      proposedAction: "REOPEN_CHECKOUT",
      proposalReason: null,
      policyResult: "ALLOW",
      policyReason: null,
      executedAction: "REOPEN_CHECKOUT",
      outcome: "RECOVERED",
      recoveredAmount: 349900,
      createdAt: DECISION_CREATED_AT,
    },
    session: {
      id: "rsess_recovered",
      status: "COMPLETED",
      attemptCount: 1,
      originalPaymentId: "pay_internal_failed",
      createdAt: SESSION_CREATED_AT,
      updatedAt: SESSION_UPDATED_AT,
    },
    order: {
      id: "ord_internal",
      amount: 349900,
      currency: "INR",
      razorpayOrderId: "order_original",
      createdAt: ORDER_CREATED_AT,
      updatedAt: ORDER_UPDATED_AT,
    },
    originalPayment: {
      id: "pay_internal_failed",
      razorpayPaymentId: "pay_rzp_failed",
      method: "card",
      gatewayStatus: "failed",
      guardianState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
      errorCode: "BAD_REQUEST_ERROR",
      errorReason: "payment_failed",
      createdAt: ORIGINAL_CREATED_AT,
      updatedAt: ORIGINAL_UPDATED_AT,
    },
    recoveredPayment: {
      id: "pay_internal_recovered",
      razorpayPaymentId: "pay_rzp_recovered",
      method: "upi",
      gatewayStatus: "captured",
      guardianState: "SUCCESS",
      failureCategory: null,
      errorCode: null,
      errorReason: null,
      createdAt: RECOVERED_CREATED_AT,
      updatedAt: RECOVERED_UPDATED_AT,
    },
  });

  assert.deepEqual(receipt, {
    decision: {
      id: "dec_recovered",
      recoverySessionId: "rsess_recovered",
      paymentId: "pay_internal_failed",
      paymentState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
      proposedAction: "REOPEN_CHECKOUT",
      proposalReason: null,
      policyResult: "ALLOW",
      policyReason: null,
      executedAction: "REOPEN_CHECKOUT",
      outcome: "RECOVERED",
      recoveredAmount: 349900,
      createdAt: DECISION_CREATED_AT,
    },
    session: {
      id: "rsess_recovered",
      status: "COMPLETED",
      attemptCount: 1,
      originalPaymentId: "pay_internal_failed",
      createdAt: SESSION_CREATED_AT,
      updatedAt: SESSION_UPDATED_AT,
    },
    order: {
      id: "ord_internal",
      amount: 349900,
      currency: "INR",
      razorpayOrderId: "order_original",
      createdAt: ORDER_CREATED_AT,
      updatedAt: ORDER_UPDATED_AT,
    },
    payments: {
      original: {
        id: "pay_internal_failed",
        razorpayPaymentId: "pay_rzp_failed",
        method: "card",
        gatewayStatus: "failed",
        guardianState: "FAILED",
        failureCategory: "GENERIC_PAYMENT_FAILED",
        errorCode: "BAD_REQUEST_ERROR",
        errorReason: "payment_failed",
        createdAt: ORIGINAL_CREATED_AT,
        updatedAt: ORIGINAL_UPDATED_AT,
      },
      recovered: {
        id: "pay_internal_recovered",
        razorpayPaymentId: "pay_rzp_recovered",
        method: "upi",
        gatewayStatus: "captured",
        guardianState: "SUCCESS",
        failureCategory: null,
        errorCode: null,
        errorReason: null,
        createdAt: RECOVERED_CREATED_AT,
        updatedAt: RECOVERED_UPDATED_AT,
      },
    },
  });
});

test("B. blocked Decision Receipt truthfully has no recovered Payment", () => {
  const receipt = deriveRecoveryDecisionReceipt({
    decision: {
      id: "dec_blocked",
      recoverySessionId: "rsess_blocked",
      paymentId: "pay_internal_original",
      paymentState: "UNRESOLVED",
      failureCategory: null,
      proposedAction: "REOPEN_CHECKOUT",
      proposalReason: null,
      policyResult: "BLOCK",
      policyReason: "CONFIRMED_FAILURE_REQUIRED",
      executedAction: null,
      outcome: null,
      recoveredAmount: null,
      createdAt: DECISION_CREATED_AT,
    },
    session: {
      id: "rsess_blocked",
      status: "OPEN",
      attemptCount: 0,
      originalPaymentId: "pay_internal_original",
      createdAt: SESSION_CREATED_AT,
      updatedAt: SESSION_UPDATED_AT,
    },
    order: {
      id: "ord_internal",
      amount: 349900,
      currency: "INR",
      razorpayOrderId: "order_original",
      createdAt: ORDER_CREATED_AT,
      updatedAt: ORDER_UPDATED_AT,
    },
    originalPayment: {
      id: "pay_internal_original",
      razorpayPaymentId: "pay_rzp_original",
      method: "card",
      gatewayStatus: "failed",
      guardianState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
      errorCode: "BAD_REQUEST_ERROR",
      errorReason: "payment_failed",
      createdAt: ORIGINAL_CREATED_AT,
      updatedAt: ORIGINAL_UPDATED_AT,
    },
    recoveredPayment: null,
  });

  assert.equal(receipt.decision.paymentState, "UNRESOLVED");
  assert.equal(receipt.decision.policyResult, "BLOCK");
  assert.equal(
    receipt.decision.policyReason,
    "CONFIRMED_FAILURE_REQUIRED",
  );
  assert.equal(receipt.decision.executedAction, null);
  assert.equal(receipt.decision.outcome, null);
  assert.equal(receipt.decision.recoveredAmount, null);

  assert.equal(receipt.session.status, "OPEN");
  assert.equal(receipt.session.attemptCount, 0);

  assert.equal(receipt.payments.original.id, "pay_internal_original");
  assert.equal(receipt.payments.recovered, null);
});