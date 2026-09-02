import assert from "node:assert/strict";
import { test } from "node:test";
import {
  interpretRecoverPaymentHttpResponse,
  shouldRetryRecoverPayment,
} from "./interpret-recover-payment-client.ts";

const validCheckout = {
  orderId: "order_original",
  amount: 349900,
  currency: "INR",
};

test("200 started:true + valid checkout → started", () => {
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: true,
      recoverySessionId: "rsess_1",
      decisionId: "dec_1",
      action: "REOPEN_CHECKOUT",
      attemptCount: 1,
      sessionStatus: "IN_PROGRESS",
      checkout: validCheckout,
    }),
    { outcome: "started", checkout: validCheckout },
  );
});

test("200 started:true with missing/malformed checkout → unsafe", () => {
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: true,
      recoverySessionId: "rsess_1",
      decisionId: "dec_1",
      action: "REOPEN_CHECKOUT",
      attemptCount: 1,
      sessionStatus: "IN_PROGRESS",
    }),
    { outcome: "unsafe" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: true,
      checkout: { orderId: "  ", amount: 349900, currency: "INR" },
    }),
    { outcome: "unsafe" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: true,
      checkout: { orderId: "order_original", amount: 0, currency: "INR" },
    }),
    { outcome: "unsafe" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: true,
      checkout: {
        orderId: "order_original",
        amount: 349900.5,
        currency: "INR",
      },
    }),
    { outcome: "unsafe" },
  );
});

test("200 PAYMENT_NOT_FOUND → payment_not_found", () => {
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "PAYMENT_NOT_FOUND",
    }),
    { outcome: "payment_not_found" },
  );
});

test("200 other started:false reasons → denied", () => {
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "ALREADY_SUCCEEDED",
    }),
    { outcome: "denied" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "RECOVERY_STATE_CHANGED",
    }),
    { outcome: "denied" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "FETCH_FAILED",
    }),
    { outcome: "denied" },
  );
});

test("non-2xx HTTP is unsafe even with a JSON reason", () => {
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(500, {
      started: false,
      reason: "INTERNAL_ERROR",
    }),
    { outcome: "unsafe" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(400, {
      started: false,
      reason: "INVALID_INPUT",
    }),
    { outcome: "unsafe" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(500, {
      started: false,
      reason: "PAYMENT_NOT_FOUND",
    }),
    { outcome: "unsafe" },
  );
});

test("malformed payloads are unsafe", () => {
  assert.deepEqual(interpretRecoverPaymentHttpResponse(200, null), {
    outcome: "unsafe",
  });
  assert.deepEqual(interpretRecoverPaymentHttpResponse(200, []), {
    outcome: "unsafe",
  });
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, { started: false }),
    { outcome: "unsafe" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, { started: false, reason: "  " }),
    { outcome: "unsafe" },
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
