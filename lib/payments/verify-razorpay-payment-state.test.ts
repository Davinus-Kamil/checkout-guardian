import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyRazorpayPaymentState } from "./verify-razorpay-payment-state.ts";

const PAYMENT_ID = "pay_test_m10";

test("1. captured + card + null errors → SUCCESS", async () => {
  const result = await verifyRazorpayPaymentState(PAYMENT_ID, async () => ({
    id: PAYMENT_ID,
    status: "captured",
    method: "card",
    error_code: null,
    error_reason: null,
  }));

  assert.equal(result.verified, true);
  if (!result.verified) {
    return;
  }

  assert.equal(result.razorpayPaymentId, PAYMENT_ID);
  assert.equal(result.gatewayStatus, "captured");
  assert.equal(result.guardianState, "SUCCESS");
  assert.equal(result.failureCategory, null);
  assert.deepEqual(result.facts, {
    normalizedStatus: "captured",
    paymentMethod: "card",
    errorCode: null,
    errorReason: null,
    isCaptured: true,
    isFailed: false,
  });
});

test("2. failed + BAD_REQUEST_ERROR/payment_failed → GENERIC_PAYMENT_FAILED", async () => {
  const result = await verifyRazorpayPaymentState(PAYMENT_ID, async () => ({
    id: PAYMENT_ID,
    status: "failed",
    method: "card",
    error_code: "BAD_REQUEST_ERROR",
    error_reason: "payment_failed",
  }));

  assert.equal(result.verified, true);
  if (!result.verified) {
    return;
  }

  assert.equal(result.guardianState, "FAILED");
  assert.equal(result.failureCategory, "GENERIC_PAYMENT_FAILED");
  assert.equal(result.facts.normalizedStatus, "failed");
});

test("3. failed with missing failure identity → UNKNOWN", async () => {
  const result = await verifyRazorpayPaymentState(PAYMENT_ID, async () => ({
    id: PAYMENT_ID,
    status: "failed",
    method: "card",
    error_code: null,
    error_reason: null,
  }));

  assert.equal(result.verified, true);
  if (!result.verified) {
    return;
  }

  assert.equal(result.guardianState, "FAILED");
  assert.equal(result.failureCategory, "UNKNOWN");
});

test("4. unsupported status authorized → UNRESOLVED", async () => {
  const result = await verifyRazorpayPaymentState(PAYMENT_ID, async () => ({
    id: PAYMENT_ID,
    status: "authorized",
    method: "card",
    error_code: null,
    error_reason: null,
  }));

  assert.equal(result.verified, true);
  if (!result.verified) {
    return;
  }

  assert.equal(result.facts.normalizedStatus, "unknown");
  assert.equal(result.guardianState, "UNRESOLVED");
  assert.equal(result.failureCategory, null);
});

test("5. fetch throws → FETCH_FAILED", async () => {
  const result = await verifyRazorpayPaymentState(PAYMENT_ID, async () => {
    throw new Error("network");
  });

  assert.deepEqual(result, {
    verified: false,
    razorpayPaymentId: PAYMENT_ID,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "FETCH_FAILED",
  });
});

test("6. malformed response / missing status → MALFORMED_PAYMENT", async () => {
  const result = await verifyRazorpayPaymentState(PAYMENT_ID, async () => ({
    id: PAYMENT_ID,
    method: "card",
  }));

  assert.deepEqual(result, {
    verified: false,
    razorpayPaymentId: PAYMENT_ID,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "MALFORMED_PAYMENT",
  });
});

test("7. returned payment ID mismatch → MALFORMED_PAYMENT", async () => {
  const result = await verifyRazorpayPaymentState(PAYMENT_ID, async () => ({
    id: "pay_other",
    status: "captured",
    method: "card",
    error_code: null,
    error_reason: null,
  }));

  assert.deepEqual(result, {
    verified: false,
    razorpayPaymentId: PAYMENT_ID,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "MALFORMED_PAYMENT",
  });
});

test("8. empty/whitespace ID does not fetch", async () => {
  let fetchCalls = 0;

  const empty = await verifyRazorpayPaymentState("", async () => {
    fetchCalls += 1;
    return {};
  });

  const whitespace = await verifyRazorpayPaymentState("   ", async () => {
    fetchCalls += 1;
    return {};
  });

  assert.equal(fetchCalls, 0);
  assert.deepEqual(empty, {
    verified: false,
    razorpayPaymentId: "",
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "INVALID_PAYMENT_ID",
  });
  assert.deepEqual(whitespace, {
    verified: false,
    razorpayPaymentId: "   ",
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "INVALID_PAYMENT_ID",
  });
});
