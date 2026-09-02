import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finalizeAuthorizedRecovery,
  type FinalizeAuthorizedRecoveryStore,
  type FinalizeAuthorizedRecoveryTx,
} from "./finalize-authorized-recovery.ts";

const ORDER_ID = "ord_internal_1";
const ORIGINAL_PAYMENT_ID = "pay_internal_failed";
const SUCCESS_PAYMENT_ID = "pay_internal_recovered";
const SESSION_ID = "rsess_1";
const DECISION_ID = "dec_1";
const ORDER_AMOUNT = 349900;
const CURRENCY = "INR";

type SessionGraph = {
  id: string;
  orderId: string;
  originalPaymentId: string;
  status: string;
  attemptCount: number;
  originalPayment: { id: string; orderId: string } | null;
  decisions: Array<{
    id: string;
    recoverySessionId: string;
    paymentId: string;
    paymentState: string;
    policyResult: string | null;
    executedAction: string | null;
    outcome: string | null;
    recoveredAmount: number | null;
  }>;
};

function authorizedDecision(
  overrides: Partial<SessionGraph["decisions"][number]> = {},
): SessionGraph["decisions"][number] {
  return {
    id: DECISION_ID,
    recoverySessionId: SESSION_ID,
    paymentId: ORIGINAL_PAYMENT_ID,
    paymentState: "FAILED",
    policyResult: "ALLOW",
    executedAction: "REOPEN_CHECKOUT",
    outcome: null,
    recoveredAmount: null,
    ...overrides,
  };
}

function inProgressSession(
  overrides: Partial<SessionGraph> = {},
): SessionGraph {
  return {
    id: SESSION_ID,
    orderId: ORDER_ID,
    originalPaymentId: ORIGINAL_PAYMENT_ID,
    status: "IN_PROGRESS",
    attemptCount: 1,
    originalPayment: { id: ORIGINAL_PAYMENT_ID, orderId: ORDER_ID },
    decisions: [authorizedDecision()],
    ...overrides,
  };
}

function createStore(options: {
  orderAmount?: number;
  orderCurrency?: string;
  successfulPayment?: { id: string; orderId: string } | null;
  sessions?: SessionGraph[];
  decisionClaimCount?: number;
  sessionClaimCount?: number;
} = {}) {
  const order = {
    id: ORDER_ID,
    amount: options.orderAmount ?? ORDER_AMOUNT,
    currency: options.orderCurrency ?? CURRENCY,
  };
  const successfulPayment =
    options.successfulPayment === undefined
      ? { id: SUCCESS_PAYMENT_ID, orderId: ORDER_ID }
      : options.successfulPayment;
  let sessions = (options.sessions ?? [inProgressSession()]).map((session) => ({
    ...session,
    decisions: session.decisions.map((decision) => ({ ...decision })),
  }));
  const writes: string[] = [];
  let transactionOpened = 0;

  const tx: FinalizeAuthorizedRecoveryTx = {
    decision: {
      updateMany: async (args) => {
        writes.push("decision.updateMany");
        const session = sessions.find(
          (row) => row.id === args.where.recoverySessionId,
        );
        const decision = session?.decisions.find(
          (row) =>
            row.id === args.where.id &&
            row.recoverySessionId === args.where.recoverySessionId &&
            row.paymentId === args.where.paymentId &&
            row.paymentState === args.where.paymentState &&
            row.policyResult === args.where.policyResult &&
            row.executedAction === args.where.executedAction &&
            row.outcome === args.where.outcome,
        );

        if (!session || !decision) {
          return { count: 0 };
        }

        const count = options.decisionClaimCount ?? 1;

        if (count === 1) {
          decision.outcome = args.data.outcome;
          decision.recoveredAmount = args.data.recoveredAmount;
        }

        return { count };
      },
    },
    recoverySession: {
      updateMany: async (args) => {
        writes.push("recoverySession.updateMany");
        const session = sessions.find(
          (row) =>
            row.id === args.where.id &&
            row.orderId === args.where.orderId &&
            row.originalPaymentId === args.where.originalPaymentId &&
            row.status === args.where.status &&
            row.attemptCount > 0,
        );

        if (!session) {
          return { count: 0 };
        }

        const count = options.sessionClaimCount ?? 1;

        if (count === 1) {
          session.status = args.data.status;
        }

        return { count };
      },
    },
  };

  const store: FinalizeAuthorizedRecoveryStore = {
    order: {
      findUnique: async (args) =>
        args.where.id === order.id ? { ...order } : null,
    },
    payment: {
      findUnique: async (args) => {
        if (!successfulPayment || successfulPayment.id !== args.where.id) {
          return null;
        }
        return { ...successfulPayment };
      },
    },
    recoverySession: {
      findMany: async (args) =>
        sessions
          .filter((session) => session.orderId === args.where.orderId)
          .map((session) => ({
            ...session,
            originalPayment: session.originalPayment
              ? { ...session.originalPayment }
              : null,
            decisions: session.decisions.map((decision) => ({ ...decision })),
          })),
    },
    $transaction: async (fn) => {
      transactionOpened += 1;
      const snapshot = sessions.map((session) => ({
        ...session,
        originalPayment: session.originalPayment
          ? { ...session.originalPayment }
          : null,
        decisions: session.decisions.map((decision) => ({ ...decision })),
      }));
      try {
        return await fn(tx);
      } catch (error) {
        sessions = snapshot;
        throw error;
      }
    },
  };

  return {
    store,
    writes,
    get transactionOpened() {
      return transactionOpened;
    },
    get sessions() {
      return sessions;
    },
  };
}

test("1. one authorized IN_PROGRESS recovery finalizes RECOVERED/COMPLETED", async () => {
  const harness = createStore();
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    finalized: true,
    recoveredAmount: ORDER_AMOUNT,
    currency: CURRENCY,
  });
  assert.equal(harness.sessions[0]?.status, "COMPLETED");
  assert.equal(harness.sessions[0]?.attemptCount, 1);
  assert.equal(harness.sessions[0]?.decisions[0]?.outcome, "RECOVERED");
  assert.equal(harness.sessions[0]?.decisions[0]?.recoveredAmount, ORDER_AMOUNT);
  assert.equal(harness.sessions[0]?.decisions[0]?.executedAction, "REOPEN_CHECKOUT");
  assert.equal(harness.sessions[0]?.decisions[0]?.policyResult, "ALLOW");
  assert.equal(harness.sessions[0]?.decisions[0]?.paymentState, "FAILED");
});

test("2. recoveredAmount comes from persisted Order, not caller extras", async () => {
  const harness = createStore({ orderAmount: 349900 });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.equal(result.finalized, true);
  if (result.finalized) {
    assert.equal(result.recoveredAmount, 349900);
  }
  assert.equal(harness.sessions[0]?.decisions[0]?.recoveredAmount, 349900);
});

test("3. attemptCount is not incremented during finalization", async () => {
  const harness = createStore({
    sessions: [inProgressSession({ attemptCount: 1 })],
  });
  await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );
  assert.equal(harness.sessions[0]?.attemptCount, 1);
  assert.equal(
    harness.writes.includes("recoverySession.updateMany"),
    true,
  );
});

test("4. zero recovery candidates is ordinary non-recovery success", async () => {
  const harness = createStore({ sessions: [] });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, { finalized: false, reason: "NOT_RECOVERY" });
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.transactionOpened, 0);
});

test("5. successful Payment equals originalPaymentId does not finalize", async () => {
  const harness = createStore({
    successfulPayment: { id: ORIGINAL_PAYMENT_ID, orderId: ORDER_ID },
  });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: ORIGINAL_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, { finalized: false, reason: "NOT_RECOVERY" });
  assert.equal(harness.sessions[0]?.status, "IN_PROGRESS");
  assert.equal(harness.sessions[0]?.decisions[0]?.outcome, null);
  assert.equal(harness.writes.length, 0);
});

test("6. two eligible IN_PROGRESS sessions fail closed with no writes", async () => {
  const harness = createStore({
    sessions: [
      inProgressSession(),
      inProgressSession({
        id: "rsess_2",
        originalPaymentId: "pay_internal_failed_2",
        originalPayment: { id: "pay_internal_failed_2", orderId: ORDER_ID },
        decisions: [
          authorizedDecision({
            id: "dec_2",
            recoverySessionId: "rsess_2",
            paymentId: "pay_internal_failed_2",
          }),
        ],
      }),
    ],
  });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, { finalized: false, reason: "AMBIGUOUS" });
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.sessions[0]?.status, "IN_PROGRESS");
  assert.equal(harness.sessions[1]?.status, "IN_PROGRESS");
});

test("7. duplicate verify of correctly finalized recovery is idempotent", async () => {
  const harness = createStore({
    sessions: [
      inProgressSession({
        status: "COMPLETED",
        decisions: [
          authorizedDecision({
            outcome: "RECOVERED",
            recoveredAmount: ORDER_AMOUNT,
          }),
        ],
      }),
    ],
  });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    finalized: true,
    recoveredAmount: ORDER_AMOUNT,
    currency: CURRENCY,
  });
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.transactionOpened, 0);
  assert.equal(harness.sessions[0]?.attemptCount, 1);
});

test("8. already RECOVERED with different recoveredAmount fails closed", async () => {
  const harness = createStore({
    sessions: [
      inProgressSession({
        status: "COMPLETED",
        decisions: [
          authorizedDecision({
            outcome: "RECOVERED",
            recoveredAmount: 1,
          }),
        ],
      }),
    ],
  });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, { finalized: false, reason: "INCONSISTENT" });
  assert.equal(harness.sessions[0]?.decisions[0]?.recoveredAmount, 1);
  assert.equal(harness.writes.length, 0);
});

test("9. RECOVERED Decision + non-COMPLETED session fails closed", async () => {
  const harness = createStore({
    sessions: [
      inProgressSession({
        status: "IN_PROGRESS",
        decisions: [
          authorizedDecision({
            outcome: "RECOVERED",
            recoveredAmount: ORDER_AMOUNT,
          }),
        ],
      }),
    ],
  });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, { finalized: false, reason: "INCONSISTENT" });
  assert.equal(harness.sessions[0]?.status, "IN_PROGRESS");
  assert.equal(harness.writes.length, 0);
});

test("10. COMPLETED session + incompatible Decision fails closed", async () => {
  const harness = createStore({
    sessions: [
      inProgressSession({
        status: "COMPLETED",
        decisions: [
          authorizedDecision({
            outcome: "FAILED",
            recoveredAmount: null,
          }),
        ],
      }),
    ],
  });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, { finalized: false, reason: "INCONSISTENT" });
  assert.equal(harness.writes.length, 0);
});

test("Decision claim 1 + session claim 0 rolls back RECOVERED write", async () => {
  const harness = createStore({ sessionClaimCount: 0 });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, { finalized: false, reason: "INCONSISTENT" });
  assert.equal(harness.sessions[0]?.status, "IN_PROGRESS");
  assert.equal(harness.sessions[0]?.attemptCount, 1);
  assert.equal(harness.sessions[0]?.decisions[0]?.outcome, null);
  assert.equal(harness.sessions[0]?.decisions[0]?.recoveredAmount, null);
  assert.equal(harness.writes.includes("decision.updateMany"), true);
  assert.equal(harness.writes.includes("recoverySession.updateMany"), true);
});

test("Decision claim 0 does not mutate session", async () => {
  const harness = createStore({ decisionClaimCount: 0 });
  const result = await finalizeAuthorizedRecovery(
    { orderId: ORDER_ID, successfulPaymentId: SUCCESS_PAYMENT_ID },
    harness.store,
  );

  assert.deepEqual(result, { finalized: false, reason: "INCONSISTENT" });
  assert.equal(harness.sessions[0]?.status, "IN_PROGRESS");
  assert.equal(harness.sessions[0]?.decisions[0]?.outcome, null);
  assert.equal(harness.writes.includes("decision.updateMany"), true);
  assert.equal(harness.writes.includes("recoverySession.updateMany"), false);
});
