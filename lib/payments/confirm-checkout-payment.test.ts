import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confirmCheckoutPayment,
  type ConfirmCheckoutPaymentStore,
} from "./confirm-checkout-payment.ts";
import type { PaymentVerificationResult } from "./verify-razorpay-payment-state.ts";

const PAYMENT_ID = "pay_checkout_success";
const RECOVERY_PAYMENT_ID = "pay_recovery_success";
const ORDER_ID = "order_original";
const INTERNAL_ORDER_ID = "ord_internal_1";
const INTERNAL_PAYMENT_ID = "pay_internal";
const SIGNATURE = "sig_valid";

const capturedFacts = {
  normalizedStatus: "captured" as const,
  paymentMethod: "card",
  errorCode: null,
  errorReason: null,
  isCaptured: true,
  isFailed: false,
};

const successVerification: PaymentVerificationResult = {
  verified: true,
  razorpayPaymentId: PAYMENT_ID,
  gatewayStatus: "captured",
  facts: capturedFacts,
  guardianState: "SUCCESS",
  failureCategory: null,
};

function unused(): never {
  throw new Error("unexpected call");
}

function notRecovery(): Promise<{
  finalized: false;
  reason: "NOT_RECOVERY";
}> {
  return Promise.resolve({ finalized: false, reason: "NOT_RECOVERY" });
}

function createStore(options?: {
  order?: { id: string } | null;
  onUpsert?: (args: unknown) => void;
}): ConfirmCheckoutPaymentStore {
  return {
    order: {
      findUnique: async (args) => {
        assert.equal(args.where.razorpayOrderId, ORDER_ID);
        if (options && "order" in options) {
          return options.order;
        }
        return { id: INTERNAL_ORDER_ID };
      },
    },
    payment: {
      upsert: async (args) => {
        options?.onUpsert?.(args);
        return { id: INTERNAL_PAYMENT_ID };
      },
    },
  };
}

function validPayload(paymentId = PAYMENT_ID) {
  return {
    razorpay_payment_id: paymentId,
    razorpay_order_id: ORDER_ID,
    razorpay_signature: SIGNATURE,
  };
}

test("1. valid signature + M10 SUCCESS persists Payment and returns verified", async () => {
  const upserts: unknown[] = [];
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: ({ orderId, paymentId, signature }) => {
      assert.equal(orderId, ORDER_ID);
      assert.equal(paymentId, PAYMENT_ID);
      assert.equal(signature, SIGNATURE);
      return true;
    },
    verifyPaymentState: async (razorpayPaymentId) => {
      assert.equal(razorpayPaymentId, PAYMENT_ID);
      return successVerification;
    },
    store: createStore({
      onUpsert: (args) => upserts.push(args),
    }),
    finalizeRecovery: notRecovery,
  });

  assert.deepEqual(result, { verified: true });
  assert.equal(upserts.length, 1);
  assert.deepEqual(upserts[0], {
    where: { razorpayPaymentId: PAYMENT_ID },
    update: { guardianState: "SUCCESS" },
    create: {
      orderId: INTERNAL_ORDER_ID,
      razorpayPaymentId: PAYMENT_ID,
      method: "card",
      gatewayStatus: "captured",
      guardianState: "SUCCESS",
      failureCategory: null,
      errorCode: null,
      errorReason: null,
    },
  });
});

test("2. valid signature + M10 verified false fails closed with no persist", async () => {
  let upserts = 0;
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: () => true,
    verifyPaymentState: async () => ({
      verified: false,
      razorpayPaymentId: PAYMENT_ID,
      guardianState: "UNRESOLVED",
      failureCategory: null,
      reason: "FETCH_FAILED",
    }),
    store: createStore({
      onUpsert: () => {
        upserts += 1;
      },
    }),
    finalizeRecovery: unused,
  });

  assert.deepEqual(result, { verified: false, httpStatus: 400 });
  assert.equal(upserts, 0);
});

test("3. valid signature + M10 FAILED fails closed with no persist", async () => {
  let upserts = 0;
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: () => true,
    verifyPaymentState: async () => ({
      verified: true,
      razorpayPaymentId: PAYMENT_ID,
      gatewayStatus: "failed",
      facts: {
        normalizedStatus: "failed",
        paymentMethod: "card",
        errorCode: "BAD_REQUEST_ERROR",
        errorReason: "payment_failed",
        isCaptured: false,
        isFailed: true,
      },
      guardianState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    }),
    store: createStore({
      onUpsert: () => {
        upserts += 1;
      },
    }),
    finalizeRecovery: unused,
  });

  assert.deepEqual(result, { verified: false, httpStatus: 400 });
  assert.equal(upserts, 0);
});

test("4. valid signature + M10 UNRESOLVED fails closed with no persist", async () => {
  let upserts = 0;
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: () => true,
    verifyPaymentState: async () => ({
      verified: true,
      razorpayPaymentId: PAYMENT_ID,
      gatewayStatus: "authorized",
      facts: {
        normalizedStatus: "unknown",
        paymentMethod: "card",
        errorCode: null,
        errorReason: null,
        isCaptured: false,
        isFailed: false,
      },
      guardianState: "UNRESOLVED",
      failureCategory: null,
    }),
    store: createStore({
      onUpsert: () => {
        upserts += 1;
      },
    }),
    finalizeRecovery: unused,
  });

  assert.deepEqual(result, { verified: false, httpStatus: 400 });
  assert.equal(upserts, 0);
});

test("5. invalid Checkout signature is rejected before M10 and persist", async () => {
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: () => false,
    verifyPaymentState: unused,
    store: {
      order: { findUnique: unused },
      payment: { upsert: unused },
    },
    finalizeRecovery: unused,
  });

  assert.deepEqual(result, { verified: false, httpStatus: 400 });
});

test("6. webhook-first upsert updates only guardianState SUCCESS", async () => {
  const upserts: Array<{ update: { guardianState: "SUCCESS" } }> = [];
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: () => true,
    verifyPaymentState: async () => successVerification,
    store: createStore({
      onUpsert: (args) => {
        upserts.push(args as { update: { guardianState: "SUCCESS" } });
      },
    }),
    finalizeRecovery: notRecovery,
  });

  assert.deepEqual(result, { verified: true });
  assert.deepEqual(Object.keys(upserts[0]?.update ?? {}), ["guardianState"]);
  assert.equal(upserts[0]?.update.guardianState, "SUCCESS");
});

test("7. verify-first recovery pay_* creates exactly one Payment upsert", async () => {
  const recoverySuccess: PaymentVerificationResult = {
    ...successVerification,
    razorpayPaymentId: RECOVERY_PAYMENT_ID,
  };
  const paymentIds: string[] = [];
  const result = await confirmCheckoutPayment(validPayload(RECOVERY_PAYMENT_ID), {
    verifySignature: ({ paymentId }) => paymentId === RECOVERY_PAYMENT_ID,
    verifyPaymentState: async (razorpayPaymentId) => {
      assert.equal(razorpayPaymentId, RECOVERY_PAYMENT_ID);
      return recoverySuccess;
    },
    store: createStore({
      onUpsert: (args) => {
        const typed = args as { where: { razorpayPaymentId: string } };
        paymentIds.push(typed.where.razorpayPaymentId);
      },
    }),
    finalizeRecovery: notRecovery,
  });

  assert.deepEqual(result, { verified: true });
  assert.deepEqual(paymentIds, [RECOVERY_PAYMENT_ID]);
});

test("8. initial successful Checkout uses the same M10 SUCCESS path", async () => {
  const calls: string[] = [];
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: () => {
      calls.push("signature");
      return true;
    },
    verifyPaymentState: async () => {
      calls.push("m10");
      return successVerification;
    },
    store: createStore({
      onUpsert: () => {
        calls.push("persist");
      },
    }),
    finalizeRecovery: async () => {
      calls.push("finalize");
      return { finalized: false, reason: "NOT_RECOVERY" };
    },
  });

  assert.deepEqual(result, { verified: true });
  assert.equal("recovery" in result, false);
  assert.deepEqual(calls, ["signature", "m10", "persist", "finalize"]);
});

test("missing Checkout fields keep existing 400 error", async () => {
  const result = await confirmCheckoutPayment(
    { razorpay_payment_id: PAYMENT_ID },
    {
      verifySignature: unused,
      verifyPaymentState: unused,
      store: {
        order: { findUnique: unused },
        payment: { upsert: unused },
      },
      finalizeRecovery: unused,
    },
  );

  assert.deepEqual(result, {
    verified: false,
    httpStatus: 400,
    error:
      "Missing razorpay_payment_id, razorpay_order_id, or razorpay_signature.",
  });
});

test("unknown local Order fails after valid signature without M10 persist", async () => {
  let m10 = 0;
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: () => true,
    verifyPaymentState: async () => {
      m10 += 1;
      return successVerification;
    },
    store: createStore({ order: null }),
    finalizeRecovery: unused,
  });

  assert.deepEqual(result, {
    verified: false,
    httpStatus: 500,
    error: "Failed to verify payment",
  });
  assert.equal(m10, 0);
});

test("13. finalized recovery is attached after persist using internal ids", async () => {
  let finalizeInput: { orderId: string; successfulPaymentId: string } | null =
    null;
  const result = await confirmCheckoutPayment(
    {
      ...validPayload(),
      recoveredAmount: 1,
      outcome: "RECOVERED",
    },
    {
      verifySignature: () => true,
      verifyPaymentState: async () => successVerification,
      store: createStore(),
      finalizeRecovery: async (input) => {
        finalizeInput = input;
        return {
          finalized: true,
          recoveredAmount: 349900,
          currency: "INR",
        };
      },
    },
  );

  assert.deepEqual(finalizeInput, {
    orderId: INTERNAL_ORDER_ID,
    successfulPaymentId: INTERNAL_PAYMENT_ID,
  });
  assert.deepEqual(result, {
    verified: true,
    recovery: {
      finalized: true,
      recoveredAmount: 349900,
      currency: "INR",
    },
  });
});

test("ambiguous recovery finalization does not claim recovered revenue", async () => {
  const result = await confirmCheckoutPayment(validPayload(), {
    verifySignature: () => true,
    verifyPaymentState: async () => successVerification,
    store: createStore(),
    finalizeRecovery: async () => ({
      finalized: false,
      reason: "AMBIGUOUS",
    }),
  });

  assert.deepEqual(result, { verified: true });
  assert.equal("recovery" in result, false);
});
