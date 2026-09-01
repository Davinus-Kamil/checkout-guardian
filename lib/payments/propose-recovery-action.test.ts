import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecoveryEligibilityResult } from "./derive-recovery-eligibility.ts";
import { proposeRecoveryAction } from "./propose-recovery-action.ts";

const eligible: RecoveryEligibilityResult = {
  eligible: true,
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
};

test("1. eligible → REOPEN_CHECKOUT", () => {
  const result = proposeRecoveryAction(eligible);

  assert.deepEqual(result, {
    proposed: true,
    action: "REOPEN_CHECKOUT",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
  });
});

test("2. NOT_VERIFIED → no proposal", () => {
  const result = proposeRecoveryAction({
    eligible: false,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "NOT_VERIFIED",
  });

  assert.deepEqual(result, {
    proposed: false,
    action: null,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "NOT_VERIFIED",
  });
});

test("3. ALREADY_SUCCEEDED → no proposal", () => {
  const result = proposeRecoveryAction({
    eligible: false,
    guardianState: "SUCCESS",
    failureCategory: null,
    reason: "ALREADY_SUCCEEDED",
  });

  assert.deepEqual(result, {
    proposed: false,
    action: null,
    guardianState: "SUCCESS",
    failureCategory: null,
    reason: "ALREADY_SUCCEEDED",
  });
});

test("4. UNRESOLVED_STATE → no proposal", () => {
  const result = proposeRecoveryAction({
    eligible: false,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "UNRESOLVED_STATE",
  });

  assert.deepEqual(result, {
    proposed: false,
    action: null,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "UNRESOLVED_STATE",
  });
});

test("5. UNKNOWN_FAILURE → no proposal", () => {
  const result = proposeRecoveryAction({
    eligible: false,
    guardianState: "FAILED",
    failureCategory: "UNKNOWN",
    reason: "UNKNOWN_FAILURE",
  });

  assert.deepEqual(result, {
    proposed: false,
    action: null,
    guardianState: "FAILED",
    failureCategory: "UNKNOWN",
    reason: "UNKNOWN_FAILURE",
  });
});

test("6. INCONSISTENT_VERIFIED_STATE → no proposal", () => {
  const result = proposeRecoveryAction({
    eligible: false,
    guardianState: "FAILED",
    failureCategory: null,
    reason: "INCONSISTENT_VERIFIED_STATE",
  });

  assert.deepEqual(result, {
    proposed: false,
    action: null,
    guardianState: "FAILED",
    failureCategory: null,
    reason: "INCONSISTENT_VERIFIED_STATE",
  });
});

test("7. proposed result has no policy/session/execution/Razorpay/method fields", () => {
  const result = proposeRecoveryAction(eligible);

  assert.equal(result.proposed, true);
  assert.deepEqual(Object.keys(result).sort(), [
    "action",
    "failureCategory",
    "guardianState",
    "proposed",
  ]);
  assert.equal("policyResult" in result, false);
  assert.equal("authorized" in result, false);
  assert.equal("attemptCount" in result, false);
  assert.equal("recoverySessionId" in result, false);
  assert.equal("executedAction" in result, false);
  assert.equal("razorpayPaymentId" in result, false);
  assert.equal("razorpayOrderId" in result, false);
  assert.equal("paymentMethod" in result, false);
});

test("8. malformed eligible:true does not emit REOPEN_CHECKOUT", () => {
  const malformed = {
    eligible: true,
    guardianState: "SUCCESS",
    failureCategory: "GENERIC_PAYMENT_FAILED",
  } as RecoveryEligibilityResult;

  const result = proposeRecoveryAction(malformed);

  assert.equal(result.proposed, false);
  assert.equal(result.action, null);
  if (result.proposed) {
    return;
  }

  assert.equal(result.reason, "INCONSISTENT_ELIGIBILITY");
  assert.notEqual(result.action, "REOPEN_CHECKOUT");
});
