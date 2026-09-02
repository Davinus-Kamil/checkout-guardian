import assert from "node:assert/strict";
import { test } from "node:test";
import {
  interpretRecoverPaymentHttpResponse,
  shouldRetryRecoverPayment,
} from "./interpret-recover-payment-client.ts";

test("200 started:true → started", () => {
  assert.equal(
    interpretRecoverPaymentHttpResponse(200, {
      started: true,
      recoverySessionId: "rsess_1",
      decisionId: "dec_1",
      action: "REOPEN_CHECKOUT",
      attemptCount: 1,
      sessionStatus: "IN_PROGRESS",
    }),
    "started",
  );
});

test("200 PAYMENT_NOT_FOUND → payment_not_found", () => {
  assert.equal(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "PAYMENT_NOT_FOUND",
    }),
    "payment_not_found",
  );
});

test("200 other started:false reasons → denied", () => {
  assert.equal(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "ALREADY_SUCCEEDED",
    }),
    "denied",
  );
  assert.equal(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "MAX_ATTEMPTS_REACHED",
      policyResult: "BLOCK",
    }),
    "denied",
  );
  assert.equal(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "FETCH_FAILED",
    }),
    "denied",
  );
});

test("non-2xx HTTP is unsafe even with a JSON reason", () => {
  assert.equal(
    interpretRecoverPaymentHttpResponse(500, {
      started: false,
      reason: "INTERNAL_ERROR",
    }),
    "unsafe",
  );
  assert.equal(
    interpretRecoverPaymentHttpResponse(400, {
      started: false,
      reason: "INVALID_INPUT",
    }),
    "unsafe",
  );
  assert.equal(
    interpretRecoverPaymentHttpResponse(500, {
      started: false,
      reason: "PAYMENT_NOT_FOUND",
    }),
    "unsafe",
  );
});

test("malformed payloads are unsafe", () => {
  assert.equal(interpretRecoverPaymentHttpResponse(200, null), "unsafe");
  assert.equal(interpretRecoverPaymentHttpResponse(200, []), "unsafe");
  assert.equal(interpretRecoverPaymentHttpResponse(200, { started: false }), "unsafe");
  assert.equal(
    interpretRecoverPaymentHttpResponse(200, { started: false, reason: "  " }),
    "unsafe",
  );
});

test("retry only PAYMENT_NOT_FOUND and only before attempt 3", () => {
  assert.equal(shouldRetryRecoverPayment("payment_not_found", 1), true);
  assert.equal(shouldRetryRecoverPayment("payment_not_found", 2), true);
  assert.equal(shouldRetryRecoverPayment("payment_not_found", 3), false);
  assert.equal(shouldRetryRecoverPayment("started", 1), false);
  assert.equal(shouldRetryRecoverPayment("denied", 1), false);
  assert.equal(shouldRetryRecoverPayment("unsafe", 1), false);
});
