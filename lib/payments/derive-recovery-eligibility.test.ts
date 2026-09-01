import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedPaymentFacts } from "./normalize-payment-facts.ts";
import type { PaymentVerificationResult } from "./verify-razorpay-payment-state.ts";
import { deriveRecoveryEligibility } from "./derive-recovery-eligibility.ts";

const UNUSED_FACTS: NormalizedPaymentFacts = {
  normalizedStatus: "unknown",
  paymentMethod: null,
  errorCode: null,
  errorReason: null,
  isCaptured: false,
  isFailed: false,
};

function verified(
  fields: Pick<
    Extract<PaymentVerificationResult, { verified: true }>,
    "guardianState" | "failureCategory"
  >,
): PaymentVerificationResult {
  return {
    verified: true,
    razorpayPaymentId: "pay_test_m11",
    gatewayStatus: "unused",
    facts: UNUSED_FACTS,
    guardianState: fields.guardianState,
    failureCategory: fields.failureCategory,
  };
}

test("1. verified:false → NOT_VERIFIED", () => {
  const result = deriveRecoveryEligibility({
    verified: false,
    razorpayPaymentId: "pay_test_m11",
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "FETCH_FAILED",
  });

  assert.deepEqual(result, {
    eligible: false,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "NOT_VERIFIED",
  });
});

test("2. SUCCESS → ALREADY_SUCCEEDED", () => {
  const result = deriveRecoveryEligibility(
    verified({ guardianState: "SUCCESS", failureCategory: null }),
  );

  assert.deepEqual(result, {
    eligible: false,
    guardianState: "SUCCESS",
    failureCategory: null,
    reason: "ALREADY_SUCCEEDED",
  });
});

test("3. UNRESOLVED → UNRESOLVED_STATE", () => {
  const result = deriveRecoveryEligibility(
    verified({ guardianState: "UNRESOLVED", failureCategory: null }),
  );

  assert.deepEqual(result, {
    eligible: false,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "UNRESOLVED_STATE",
  });
});

test("4. FAILED + GENERIC_PAYMENT_FAILED → eligible", () => {
  const result = deriveRecoveryEligibility(
    verified({
      guardianState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    }),
  );

  assert.deepEqual(result, {
    eligible: true,
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
  });
});

test("5. FAILED + UNKNOWN → UNKNOWN_FAILURE", () => {
  const result = deriveRecoveryEligibility(
    verified({ guardianState: "FAILED", failureCategory: "UNKNOWN" }),
  );

  assert.deepEqual(result, {
    eligible: false,
    guardianState: "FAILED",
    failureCategory: "UNKNOWN",
    reason: "UNKNOWN_FAILURE",
  });
});

test("6. eligible result has no action/policy/session/execution authority", () => {
  const result = deriveRecoveryEligibility(
    verified({
      guardianState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    }),
  );

  assert.equal(result.eligible, true);
  assert.deepEqual(Object.keys(result).sort(), [
    "eligible",
    "failureCategory",
    "guardianState",
  ]);
  assert.equal("proposedAction" in result, false);
  assert.equal("candidateAction" in result, false);
  assert.equal("policyResult" in result, false);
  assert.equal("executedAction" in result, false);
  assert.equal("attemptCount" in result, false);
  assert.equal("recoverySessionId" in result, false);
});

test("7. FAILED + null category fails closed", () => {
  const result = deriveRecoveryEligibility(
    verified({ guardianState: "FAILED", failureCategory: null }),
  );

  assert.deepEqual(result, {
    eligible: false,
    guardianState: "FAILED",
    failureCategory: null,
    reason: "INCONSISTENT_VERIFIED_STATE",
  });
});

test("8. SUCCESS + GENERIC_PAYMENT_FAILED → ALREADY_SUCCEEDED", () => {
  const result = deriveRecoveryEligibility(
    verified({
      guardianState: "SUCCESS",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    }),
  );

  assert.deepEqual(result, {
    eligible: false,
    guardianState: "SUCCESS",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    reason: "ALREADY_SUCCEEDED",
  });
});

test("9. UNRESOLVED + GENERIC_PAYMENT_FAILED → UNRESOLVED_STATE", () => {
  const result = deriveRecoveryEligibility(
    verified({
      guardianState: "UNRESOLVED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    }),
  );

  assert.deepEqual(result, {
    eligible: false,
    guardianState: "UNRESOLVED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    reason: "UNRESOLVED_STATE",
  });
});
