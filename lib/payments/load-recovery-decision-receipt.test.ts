import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadRecoveryDecisionReceipt,
  mapRecoveryDecisionReceiptHttp,
  type RecoveryDecisionReceipt,
  type RecoveryDecisionReceiptStore,
} from "./load-recovery-decision-receipt.ts";

const CREATED_AT = new Date("2026-09-02T10:00:00.000Z");
const UPDATED_AT = new Date("2026-09-02T10:05:00.000Z");

type DecisionRecord = Awaited<
  ReturnType<RecoveryDecisionReceiptStore["decision"]["findUnique"]>
>;

type SessionRecord = Awaited<
  ReturnType<RecoveryDecisionReceiptStore["recoverySession"]["findUnique"]>
>;

type OrderRecord = Awaited<
  ReturnType<RecoveryDecisionReceiptStore["order"]["findUnique"]>
>;

type PaymentRecord = NonNullable<
  Awaited<
    ReturnType<RecoveryDecisionReceiptStore["payment"]["findUnique"]>
  >
>;

function createStore(input?: {
  decision?: DecisionRecord;
  session?: SessionRecord;
  order?: OrderRecord;
  payments?: PaymentRecord[];
}) {
  const payments = input?.payments ?? [];

  const store: RecoveryDecisionReceiptStore = {
    decision: {
      async findUnique() {
        return input?.decision ?? null;
      },
    },
    recoverySession: {
      async findUnique() {
        return input?.session ?? null;
      },
    },
    order: {
      async findUnique() {
        return input?.order ?? null;
      },
    },
    payment: {
      async findUnique(args) {
        return (
          payments.find(
            (payment) => payment.id === args.where.id,
          ) ?? null
        );
      },
      async findMany(args) {
        return payments.filter(
          (payment) => payment.orderId === args.where.orderId,
        );
      },
    },
  };

  return store;
}

function originalPayment(): PaymentRecord {
  return {
    id: "pay_original",
    orderId: "ord_1",
    razorpayPaymentId: "pay_rzp_original",
    method: "card",
    gatewayStatus: "failed",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: "payment_failed",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  };
}

function recoveredPayment(): PaymentRecord {
  return {
    id: "pay_recovered",
    orderId: "ord_1",
    razorpayPaymentId: "pay_rzp_recovered",
    method: "card",
    gatewayStatus: "captured",
    guardianState: "SUCCESS",
    failureCategory: null,
    errorCode: null,
    errorReason: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  };
}

const order = {
  id: "ord_1",
  amount: 349900,
  currency: "INR",
  razorpayOrderId: "order_rzp_1",
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

test("1. blank Decision id fails before database lookup", async () => {
  const result = await loadRecoveryDecisionReceipt(
    "   ",
    createStore(),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "INVALID_DECISION_ID",
  });
});

test("2. unknown Decision fails closed", async () => {
  const result = await loadRecoveryDecisionReceipt(
    "dec_missing",
    createStore(),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "DECISION_NOT_FOUND",
  });
});

test("3. recovered Decision loads a complete authoritative receipt", async () => {
  const result = await loadRecoveryDecisionReceipt(
    "dec_recovered",
    createStore({
      decision: {
        id: "dec_recovered",
        recoverySessionId: "rsess_1",
        paymentId: "pay_original",
        failureCategory: "GENERIC_PAYMENT_FAILED",
        paymentState: "FAILED",
        proposedAction: "REOPEN_CHECKOUT",
        proposalReason: null,
        policyResult: "ALLOW",
        policyReason: null,
        executedAction: "REOPEN_CHECKOUT",
        outcome: "RECOVERED",
        recoveredAmount: 349900,
        createdAt: CREATED_AT,
      },
      session: {
        id: "rsess_1",
        orderId: "ord_1",
        originalPaymentId: "pay_original",
        status: "COMPLETED",
        attemptCount: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      order,
      payments: [originalPayment(), recoveredPayment()],
    }),
  );

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.equal(result.receipt.decision.id, "dec_recovered");
  assert.equal(result.receipt.decision.outcome, "RECOVERED");
  assert.equal(result.receipt.decision.recoveredAmount, 349900);
  assert.equal(
    result.receipt.payments.original.id,
    "pay_original",
  );
  assert.equal(
    result.receipt.payments.recovered?.id,
    "pay_recovered",
  );
});

test("4. blocked Decision loads without inventing a recovered Payment", async () => {
  const result = await loadRecoveryDecisionReceipt(
    "dec_blocked",
    createStore({
      decision: {
        id: "dec_blocked",
        recoverySessionId: "rsess_blocked",
        paymentId: "pay_original",
        failureCategory: null,
        paymentState: "UNRESOLVED",
        proposedAction: "REOPEN_CHECKOUT",
        proposalReason: null,
        policyResult: "BLOCK",
        policyReason: "CONFIRMED_FAILURE_REQUIRED",
        executedAction: null,
        outcome: null,
        recoveredAmount: null,
        createdAt: CREATED_AT,
      },
      session: {
        id: "rsess_blocked",
        orderId: "ord_1",
        originalPaymentId: "pay_original",
        status: "OPEN",
        attemptCount: 0,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      order,
      payments: [originalPayment()],
    }),
  );

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.equal(result.receipt.decision.paymentState, "UNRESOLVED");
  assert.equal(result.receipt.decision.policyResult, "BLOCK");
  assert.equal(
    result.receipt.decision.policyReason,
    "CONFIRMED_FAILURE_REQUIRED",
  );
  assert.equal(result.receipt.payments.recovered, null);
});

test("5. multiple successful Payments on the Order fail closed as ambiguous", async () => {
  const extraRecovered: PaymentRecord = {
    ...recoveredPayment(),
    id: "pay_recovered_2",
    razorpayPaymentId: "pay_rzp_recovered_2",
  };

  const result = await loadRecoveryDecisionReceipt(
    "dec_recovered",
    createStore({
      decision: {
        id: "dec_recovered",
        recoverySessionId: "rsess_1",
        paymentId: "pay_original",
        failureCategory: "GENERIC_PAYMENT_FAILED",
        paymentState: "FAILED",
        proposedAction: "REOPEN_CHECKOUT",
        proposalReason: null,
        policyResult: "ALLOW",
        policyReason: null,
        executedAction: "REOPEN_CHECKOUT",
        outcome: "RECOVERED",
        recoveredAmount: 349900,
        createdAt: CREATED_AT,
      },
      session: {
        id: "rsess_1",
        orderId: "ord_1",
        originalPaymentId: "pay_original",
        status: "COMPLETED",
        attemptCount: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      order,
      payments: [
        originalPayment(),
        recoveredPayment(),
        extraRecovered,
      ],
    }),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "INCONSISTENT",
  });
});

test("HTTP mapping: ok receipt is 200", () => {
  const receipt = {
    decision: { id: "dec_1" },
  } as RecoveryDecisionReceipt;

  assert.deepEqual(
    mapRecoveryDecisionReceiptHttp({
      ok: true,
      receipt,
    }),
    {
      status: 200,
      body: { receipt },
    },
  );
});

test("HTTP mapping: load failures map to 400/404/409 without leaking internals", () => {
  assert.deepEqual(
    mapRecoveryDecisionReceiptHttp({
      ok: false,
      reason: "INVALID_DECISION_ID",
    }),
    {
      status: 400,
      body: { error: "INVALID_DECISION_ID" },
    },
  );
  assert.deepEqual(
    mapRecoveryDecisionReceiptHttp({
      ok: false,
      reason: "DECISION_NOT_FOUND",
    }),
    {
      status: 404,
      body: { error: "DECISION_NOT_FOUND" },
    },
  );
  assert.deepEqual(
    mapRecoveryDecisionReceiptHttp({
      ok: false,
      reason: "INCONSISTENT",
    }),
    {
      status: 409,
      body: { error: "INCONSISTENT" },
    },
  );
});