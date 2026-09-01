import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePaymentFacts } from "./normalize-payment-facts.ts";

test("A. captured payment with card and null errors", () => {
  const result = normalizePaymentFacts({
    gatewayStatus: "captured",
    method: "card",
    errorCode: null,
    errorReason: null,
  });

  assert.deepEqual(result, {
    normalizedStatus: "captured",
    paymentMethod: "card",
    errorCode: null,
    errorReason: null,
    isCaptured: true,
    isFailed: false,
  });
});

test("A. captured payment with null method does not invent card", () => {
  const result = normalizePaymentFacts({
    gatewayStatus: "captured",
    method: null,
    errorCode: null,
    errorReason: null,
  });

  assert.equal(result.normalizedStatus, "captured");
  assert.equal(result.paymentMethod, null);
  assert.equal(result.isCaptured, true);
  assert.equal(result.isFailed, false);
});

test("B. failed payment with BAD_REQUEST_ERROR/payment_failed", () => {
  const result = normalizePaymentFacts({
    gatewayStatus: "failed",
    method: "card",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: "payment_failed",
  });

  assert.deepEqual(result, {
    normalizedStatus: "failed",
    paymentMethod: "card",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: "payment_failed",
    isCaptured: false,
    isFailed: true,
  });
});

test("C. unknown sentinel with null method and errors", () => {
  const result = normalizePaymentFacts({
    gatewayStatus: "unknown",
    method: null,
    errorCode: null,
    errorReason: null,
  });

  assert.deepEqual(result, {
    normalizedStatus: "unknown",
    paymentMethod: null,
    errorCode: null,
    errorReason: null,
    isCaptured: false,
    isFailed: false,
  });
});

test("C. null gateway status fail-closes to unknown", () => {
  const result = normalizePaymentFacts({
    gatewayStatus: null,
    method: null,
    errorCode: null,
    errorReason: null,
  });

  assert.equal(result.normalizedStatus, "unknown");
  assert.equal(result.isCaptured, false);
  assert.equal(result.isFailed, false);
});

test("C. blank and unrecognized gateway status fail-close to unknown", () => {
  const blank = normalizePaymentFacts({
    gatewayStatus: "   ",
    method: "  ",
    errorCode: "",
    errorReason: "\t",
  });

  assert.deepEqual(blank, {
    normalizedStatus: "unknown",
    paymentMethod: null,
    errorCode: null,
    errorReason: null,
    isCaptured: false,
    isFailed: false,
  });

  const unrecognized = normalizePaymentFacts({
    gatewayStatus: "authorized",
    method: "card",
    errorCode: null,
    errorReason: null,
  });

  assert.equal(unrecognized.normalizedStatus, "unknown");
  assert.equal(unrecognized.paymentMethod, "card");
  assert.equal(unrecognized.isCaptured, false);
  assert.equal(unrecognized.isFailed, false);
});
