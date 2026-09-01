import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPaymentFailure } from "./classify-payment-failure.ts";

test("A. recognized failed envelope → GENERIC_PAYMENT_FAILED", () => {
  const result = classifyPaymentFailure({
    normalizedStatus: "failed",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: "payment_failed",
  });

  assert.equal(result, "GENERIC_PAYMENT_FAILED");
});

test("B. failed with missing details → UNKNOWN", () => {
  const missingBoth = classifyPaymentFailure({
    normalizedStatus: "failed",
    errorCode: null,
    errorReason: null,
  });

  assert.equal(missingBoth, "UNKNOWN");

  const missingReason = classifyPaymentFailure({
    normalizedStatus: "failed",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: null,
  });

  assert.equal(missingReason, "UNKNOWN");
});

test("C. failed with unrecognized details → UNKNOWN", () => {
  const unrecognized = classifyPaymentFailure({
    normalizedStatus: "failed",
    errorCode: "GATEWAY_ERROR",
    errorReason: "issuer_declined",
  });

  assert.equal(unrecognized, "UNKNOWN");

  const differentReason = classifyPaymentFailure({
    normalizedStatus: "failed",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: "card_declined",
  });

  assert.equal(differentReason, "UNKNOWN");
});

test("D. non-failed captured → null", () => {
  const result = classifyPaymentFailure({
    normalizedStatus: "captured",
    errorCode: null,
    errorReason: null,
  });

  assert.equal(result, null);
});

test("D. non-failed unknown must not return FailureCategory.UNKNOWN", () => {
  const result = classifyPaymentFailure({
    normalizedStatus: "unknown",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: "payment_failed",
  });

  assert.equal(result, null);
  assert.notEqual(result, "UNKNOWN");
});
