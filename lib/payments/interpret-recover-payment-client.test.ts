import assert from "node:assert/strict";
import { test } from "node:test";
import {
  interpretRecoverPaymentHttpResponse,
  recoverPaymentRequestBody,
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
  assert.equal(shouldRetryRecoverPayment("hold", 1), false);
});

test("A. CONFIRMED_FAILURE_REQUIRED → hold, not started", () => {
  const result = interpretRecoverPaymentHttpResponse(200, {
    started: false,
    reason: "CONFIRMED_FAILURE_REQUIRED",
    policyResult: "BLOCK",
    recoverySessionId: "rsess_1",
    decisionId: "dec_1",
  });

  assert.deepEqual(result, { outcome: "hold" });
  assert.notEqual(result.outcome, "started");
  assert.notEqual(result.outcome, "denied");
  assert.equal("checkout" in result, false);
});

test("B. hold outcome is not started even if a checkout object is present", () => {
  const result = interpretRecoverPaymentHttpResponse(200, {
    started: false,
    reason: "CONFIRMED_FAILURE_REQUIRED",
    policyResult: "BLOCK",
    checkout: validCheckout,
  });

  assert.equal(result.outcome, "hold");
  assert.equal("checkout" in result, false);
});

test("C. started:true + valid checkout still produces started", () => {
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: true,
      checkout: validCheckout,
    }),
    { outcome: "started", checkout: validCheckout },
  );
});

test("D. malformed started:true without valid checkout remains unsafe", () => {
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: true,
      reason: "CONFIRMED_FAILURE_REQUIRED",
    }),
    { outcome: "unsafe" },
  );
});

test("E. existing denied/unsafe behavior is unchanged", () => {
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "MAX_ATTEMPTS_REACHED",
      policyResult: "BLOCK",
    }),
    { outcome: "denied" },
  );
  assert.deepEqual(
    interpretRecoverPaymentHttpResponse(200, {
      started: false,
      reason: "UNRESOLVED_STATE",
    }),
    { outcome: "denied" },
  );
});

test("M14 recover body omits the simulation flag", () => {
  assert.deepEqual(recoverPaymentRequestBody("pay_1", false), {
    razorpay_payment_id: "pay_1",
  });
  assert.equal(
    "simulate_unresolved_guardian" in recoverPaymentRequestBody("pay_1", false),
    false,
  );
});

test("Scenario B recover body only adds simulate_unresolved_guardian true", () => {
  assert.deepEqual(recoverPaymentRequestBody("pay_1", true), {
    razorpay_payment_id: "pay_1",
    simulate_unresolved_guardian: true,
  });
});
