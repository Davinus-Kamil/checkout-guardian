import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadRecoveryGateContext,
  type RecoveryGateContextStore,
} from "./load-recovery-gate-context.ts";

const RAZORPAY_PAYMENT_ID = "pay_test_m14";
const PAYMENT_ID = "pay_internal_1";
const ORDER_ID = "ord_internal_1";
const MERCHANT_ID = "merch_1";
const SESSION_ID = "rsess_1";

type LoadedPayment = Awaited<
  ReturnType<RecoveryGateContextStore["payment"]["findUnique"]>
>;
type LoadedSession = Awaited<
  ReturnType<RecoveryGateContextStore["recoverySession"]["findUnique"]>
>;

function createStore(options: {
  payment?: LoadedPayment;
  session?: LoadedSession;
}): {
  store: RecoveryGateContextStore;
  paymentLookups: number;
  sessionLookups: number;
  writes: string[];
} {
  const writes: string[] = [];
  let paymentLookups = 0;
  let sessionLookups = 0;

  const recordWrite = (name: string) => async () => {
    writes.push(name);
    throw new Error(`unexpected write: ${name}`);
  };

  const store = {
    payment: {
      findUnique: async () => {
        paymentLookups += 1;
        return options.payment ?? null;
      },
      create: recordWrite("payment.create"),
      update: recordWrite("payment.update"),
      upsert: recordWrite("payment.upsert"),
      delete: recordWrite("payment.delete"),
    },
    recoverySession: {
      findUnique: async () => {
        sessionLookups += 1;
        return options.session ?? null;
      },
      create: recordWrite("recoverySession.create"),
      update: recordWrite("recoverySession.update"),
      upsert: recordWrite("recoverySession.upsert"),
      delete: recordWrite("recoverySession.delete"),
    },
    decision: {
      create: recordWrite("decision.create"),
      update: recordWrite("decision.update"),
      upsert: recordWrite("decision.upsert"),
    },
  } as RecoveryGateContextStore & Record<string, unknown>;

  return {
    store,
    get paymentLookups() {
      return paymentLookups;
    },
    get sessionLookups() {
      return sessionLookups;
    },
    writes,
  };
}

function paymentWithPolicy(policy: Record<string, unknown> | null): LoadedPayment {
  return {
    id: PAYMENT_ID,
    orderId: ORDER_ID,
    order: {
      id: ORDER_ID,
      merchantId: MERCHANT_ID,
      merchant: {
        id: MERCHANT_ID,
        policy: policy as LoadedPayment extends {
          order: infer Order;
        }
          ? Order extends { merchant: infer Merchant }
            ? Merchant extends { policy: infer Policy }
              ? Policy
              : never
            : never
          : never,
      },
    },
  };
}

test("1. blank Razorpay payment ID → INVALID_PAYMENT_ID and no Prisma lookup", async () => {
  const harness = createStore({
    payment: paymentWithPolicy({
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 1,
    }),
  });

  const result = await loadRecoveryGateContext("   ", harness.store);

  assert.deepEqual(result, {
    ok: false,
    reason: "INVALID_PAYMENT_ID",
  });
  assert.equal(harness.paymentLookups, 0);
  assert.equal(harness.sessionLookups, 0);
  assert.deepEqual(harness.writes, []);
});

test("2. unknown payment → PAYMENT_NOT_FOUND", async () => {
  const harness = createStore({ payment: null });

  const result = await loadRecoveryGateContext(RAZORPAY_PAYMENT_ID, harness.store);

  assert.deepEqual(result, {
    ok: false,
    reason: "PAYMENT_NOT_FOUND",
  });
  assert.equal(harness.paymentLookups, 1);
  assert.equal(harness.sessionLookups, 0);
});

test("3. payment + order + policy + no session → projected policy, attemptCount 0", async () => {
  const harness = createStore({
    payment: paymentWithPolicy({
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 2,
      allowAlternativeMethod: true,
      unknownStateAction: "HOLD",
      riskFailureAction: "BLOCK",
    }),
    session: null,
  });

  const result = await loadRecoveryGateContext(RAZORPAY_PAYMENT_ID, harness.store);

  assert.deepEqual(result, {
    ok: true,
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    merchantId: MERCHANT_ID,
    policy: {
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 2,
    },
    attemptCount: 0,
    recoverySessionId: null,
  });
});

test("4. payment + order + policy + existing session → session id and attemptCount", async () => {
  const harness = createStore({
    payment: paymentWithPolicy({
      requireConfirmedFailure: false,
      maxRecoveryAttempts: 3,
    }),
    session: {
      id: SESSION_ID,
      attemptCount: 2,
    },
  });

  const result = await loadRecoveryGateContext(RAZORPAY_PAYMENT_ID, harness.store);

  assert.deepEqual(result, {
    ok: true,
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    merchantId: MERCHANT_ID,
    policy: {
      requireConfirmedFailure: false,
      maxRecoveryAttempts: 3,
    },
    attemptCount: 2,
    recoverySessionId: SESSION_ID,
  });
});

test("5. payment/order exists but policy missing → success with policy null", async () => {
  const harness = createStore({
    payment: paymentWithPolicy(null),
    session: null,
  });

  const result = await loadRecoveryGateContext(RAZORPAY_PAYMENT_ID, harness.store);

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.policy, null);
  assert.equal(result.attemptCount, 0);
  assert.equal(result.recoverySessionId, null);
});

test("6. inconsistent/missing Order → ORDER_NOT_FOUND", async () => {
  const harness = createStore({
    payment: {
      id: PAYMENT_ID,
      orderId: ORDER_ID,
      order: null,
    },
  });

  const result = await loadRecoveryGateContext(RAZORPAY_PAYMENT_ID, harness.store);

  assert.deepEqual(result, {
    ok: false,
    reason: "ORDER_NOT_FOUND",
  });
  assert.equal(harness.sessionLookups, 0);
});

test("7. success result does not expose payment internals, policy extras, or secrets", async () => {
  const harness = createStore({
    payment: {
      id: PAYMENT_ID,
      orderId: ORDER_ID,
      method: "card",
      gatewayStatus: "failed",
      errorCode: "BAD_REQUEST_ERROR",
      errorReason: "payment_failed",
      order: {
        id: ORDER_ID,
        merchantId: MERCHANT_ID,
        merchant: {
          id: MERCHANT_ID,
          policy: {
            requireConfirmedFailure: true,
            maxRecoveryAttempts: 1,
            allowAlternativeMethod: true,
            unknownStateAction: "HOLD",
            riskFailureAction: "BLOCK",
            createdAt: new Date(),
          },
        },
      },
    } as LoadedPayment,
    session: null,
  });

  const result = await loadRecoveryGateContext(RAZORPAY_PAYMENT_ID, harness.store);

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(Object.keys(result).sort(), [
    "attemptCount",
    "merchantId",
    "ok",
    "orderId",
    "paymentId",
    "policy",
    "recoverySessionId",
  ]);
  assert.deepEqual(Object.keys(result.policy ?? {}).sort(), [
    "maxRecoveryAttempts",
    "requireConfirmedFailure",
  ]);

  const serialized = JSON.stringify(result);
  assert.equal("method" in result, false);
  assert.equal("gatewayStatus" in result, false);
  assert.equal("errorCode" in result, false);
  assert.equal("errorReason" in result, false);
  assert.equal("allowAlternativeMethod" in (result.policy ?? {}), false);
  assert.equal("unknownStateAction" in (result.policy ?? {}), false);
  assert.equal("riskFailureAction" in (result.policy ?? {}), false);
  assert.match(serialized, /"paymentId":"pay_internal_1"/);
  assert.equal(serialized.includes("card"), false);
  assert.equal(serialized.includes("BAD_REQUEST_ERROR"), false);
  assert.equal(serialized.includes("allowAlternativeMethod"), false);
  assert.equal(serialized.includes("unknownStateAction"), false);
  assert.equal(serialized.includes("riskFailureAction"), false);
  assert.equal(serialized.includes("key_secret"), false);
  assert.equal(serialized.includes("RAZORPAY_KEY_SECRET"), false);
});

test("8. loader performs no writes, session creation, or Decision creation", async () => {
  const harness = createStore({
    payment: paymentWithPolicy({
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 1,
    }),
    session: null,
  });

  const result = await loadRecoveryGateContext(RAZORPAY_PAYMENT_ID, harness.store);

  assert.equal(result.ok, true);
  assert.deepEqual(harness.writes, []);
  assert.equal(harness.paymentLookups, 1);
  assert.equal(harness.sessionLookups, 1);

  const writable = harness.store as RecoveryGateContextStore & {
    payment: Record<string, unknown>;
    recoverySession: Record<string, unknown>;
    decision?: Record<string, unknown>;
  };

  assert.equal(typeof writable.payment.create, "function");
  assert.equal(typeof writable.recoverySession.create, "function");
  assert.equal(typeof writable.decision?.create, "function");
});
