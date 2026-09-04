import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_MERCHANT_ID } from "../merchants/demo-merchant.ts";
import {
  loadRecoveryPortfolio,
  type RecoveryPortfolioStore,
} from "./load-recovery-portfolio.ts";

type FindManyArgs = Parameters<
  RecoveryPortfolioStore["recoverySession"]["findMany"]
>[0];

type LoadedSession = Awaited<
  ReturnType<RecoveryPortfolioStore["recoverySession"]["findMany"]>
>[number];

type LoadedDecision = LoadedSession["decisions"][number];

function decision(
  overrides: Partial<LoadedDecision> = {},
): LoadedDecision {
  return {
    id: "dec_1",
    paymentState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    policyResult: "ALLOW",
    policyReason: null,
    outcome: null,
    recoveredAmount: null,
    ...overrides,
  };
}

function session(
  overrides: Partial<LoadedSession> = {},
): LoadedSession {
  return {
    id: "rsess_1",
    orderId: "ord_1",
    originalPaymentId: "pay_original_1",
    status: "OPEN",
    attemptCount: 0,
    order: {
      id: "ord_1",
      amount: 349900,
    },
    originalPayment: {
      id: "pay_original_1",
      guardianState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    },
    decisions: [],
    ...overrides,
  };
}

function createStore(sessions: LoadedSession[]) {
  const writes: string[] = [];
  let findManyArgs: FindManyArgs | null = null;

  const recordWrite = (name: string) => async () => {
    writes.push(name);
    throw new Error(`unexpected write: ${name}`);
  };

  const store = {
    recoverySession: {
      findMany: async (args: FindManyArgs) => {
        findManyArgs = args;
        return sessions;
      },
      create: recordWrite("recoverySession.create"),
      update: recordWrite("recoverySession.update"),
      upsert: recordWrite("recoverySession.upsert"),
      delete: recordWrite("recoverySession.delete"),
    },
    order: {
      create: recordWrite("order.create"),
      update: recordWrite("order.update"),
    },
    payment: {
      create: recordWrite("payment.create"),
      update: recordWrite("payment.update"),
    },
    decision: {
      create: recordWrite("decision.create"),
      update: recordWrite("decision.update"),
      upsert: recordWrite("decision.upsert"),
    },
  } as RecoveryPortfolioStore & Record<string, unknown>;

  return {
    store,
    writes,
    get findManyArgs() {
      return findManyArgs;
    },
  };
}

test("A. maps one recovered session into RECOVERED and preserves persisted recoveredAmount", async () => {
  const harness = createStore([
    session({
      status: "COMPLETED",
      attemptCount: 1,
      decisions: [
        decision({
          id: "dec_recovered",
          policyResult: "ALLOW",
          outcome: "RECOVERED",
          recoveredAmount: 349900,
        }),
      ],
    }),
  ]);

  const cases = await loadRecoveryPortfolio(harness.store);

  assert.equal(cases.length, 1);
  assert.equal(cases[0]?.classification, "RECOVERED");
  assert.equal(cases[0]?.recoveredAmountPaise, 349900);
  assert.equal(cases[0]?.amountPaise, 349900);
  assert.equal(cases[0]?.latestDecisionId, "dec_recovered");
  assert.deepEqual(harness.writes, []);
});

test("B. maps unresolved CONFIRMED_FAILURE_REQUIRED block into HOLD_ESCALATE", async () => {
  const harness = createStore([
    session({
      originalPayment: {
        id: "pay_original_1",
        guardianState: "UNRESOLVED",
        failureCategory: null,
      },
      decisions: [
        decision({
          id: "dec_hold",
          paymentState: "UNRESOLVED",
          failureCategory: null,
          policyResult: "BLOCK",
          policyReason: "CONFIRMED_FAILURE_REQUIRED",
        }),
      ],
    }),
  ]);

  const cases = await loadRecoveryPortfolio(harness.store);

  assert.equal(cases[0]?.classification, "HOLD_ESCALATE");
  assert.equal(cases[0]?.policyReason, "CONFIRMED_FAILURE_REQUIRED");
  assert.equal(cases[0]?.outcome, null);
  assert.equal(cases[0]?.recoveredAmountPaise, null);
});

test("C. maps MAX_ATTEMPTS_REACHED block into STOPPED", async () => {
  const harness = createStore([
    session({
      attemptCount: 1,
      decisions: [
        decision({
          id: "dec_stopped",
          policyResult: "BLOCK",
          policyReason: "MAX_ATTEMPTS_REACHED",
        }),
      ],
    }),
  ]);

  const cases = await loadRecoveryPortfolio(harness.store);

  assert.equal(cases[0]?.classification, "STOPPED");
  assert.equal(cases[0]?.policyReason, "MAX_ATTEMPTS_REACHED");
});

test("D. maps confirmed failed ALLOW OPEN case into RECOVERABLE", async () => {
  const harness = createStore([
    session({
      decisions: [decision({ id: "dec_allow" })],
    }),
  ]);

  const cases = await loadRecoveryPortfolio(harness.store);

  assert.equal(cases[0]?.classification, "RECOVERABLE");
  assert.equal(cases[0]?.sessionStatus, "OPEN");
  assert.equal(cases[0]?.policyResult, "ALLOW");
  assert.equal(cases[0]?.outcome, null);
});

test("E. latest Decision is the one mapped/classified", async () => {
  const harness = createStore([
    session({
      decisions: [
        decision({
          id: "dec_latest",
          policyResult: "BLOCK",
          policyReason: "MAX_ATTEMPTS_REACHED",
        }),
        decision({
          id: "dec_older",
          policyResult: "ALLOW",
          policyReason: null,
        }),
      ],
    }),
  ]);

  const cases = await loadRecoveryPortfolio(harness.store);

  assert.equal(cases[0]?.latestDecisionId, "dec_latest");
  assert.equal(cases[0]?.classification, "STOPPED");
  assert.equal(harness.findManyArgs?.select.decisions.take, 1);
  assert.deepEqual(harness.findManyArgs?.select.decisions.orderBy, {
    createdAt: "desc",
  });
});

test("F. Decision paymentState/failureCategory take precedence over original Payment", async () => {
  const harness = createStore([
    session({
      originalPayment: {
        id: "pay_original_1",
        guardianState: "SUCCESS",
        failureCategory: "UNKNOWN",
      },
      decisions: [
        decision({
          paymentState: "FAILED",
          failureCategory: "GENERIC_PAYMENT_FAILED",
        }),
      ],
    }),
  ]);

  const cases = await loadRecoveryPortfolio(harness.store);

  assert.equal(cases[0]?.paymentState, "FAILED");
  assert.equal(cases[0]?.failureCategory, "GENERIC_PAYMENT_FAILED");
  assert.equal(cases[0]?.classification, "RECOVERABLE");
});

test("G. no Decision fails closed and does not invent policy/recovery facts", async () => {
  const harness = createStore([session({ decisions: [] })]);

  const cases = await loadRecoveryPortfolio(harness.store);

  assert.equal(cases[0]?.latestDecisionId, null);
  assert.equal(cases[0]?.policyResult, null);
  assert.equal(cases[0]?.policyReason, null);
  assert.equal(cases[0]?.outcome, null);
  assert.equal(cases[0]?.recoveredAmountPaise, null);
  assert.equal(cases[0]?.paymentState, "FAILED");
  assert.equal(cases[0]?.failureCategory, "GENERIC_PAYMENT_FAILED");
  assert.equal(cases[0]?.classification, "HOLD_ESCALATE");
  assert.notEqual(cases[0]?.classification, "RECOVERABLE");
});

test("H. recoveredAmount is never inferred from Order amount", async () => {
  const harness = createStore([
    session({
      status: "COMPLETED",
      order: { id: "ord_1", amount: 349900 },
      decisions: [
        decision({
          outcome: "RECOVERED",
          recoveredAmount: 1200,
        }),
      ],
    }),
    session({
      id: "rsess_no_recovered_amount",
      orderId: "ord_2",
      originalPaymentId: "pay_original_2",
      status: "COMPLETED",
      attemptCount: 1,
      order: { id: "ord_2", amount: 349900 },
      originalPayment: {
        id: "pay_original_2",
        guardianState: "FAILED",
        failureCategory: "GENERIC_PAYMENT_FAILED",
      },
      decisions: [
        decision({
          id: "dec_missing_amount",
          outcome: "RECOVERED",
          recoveredAmount: null,
        }),
      ],
    }),
  ]);

  const cases = await loadRecoveryPortfolio(harness.store);

  assert.equal(cases[0]?.amountPaise, 349900);
  assert.equal(cases[0]?.recoveredAmountPaise, 1200);
  assert.equal(cases[1]?.amountPaise, 349900);
  assert.equal(cases[1]?.recoveredAmountPaise, null);
  assert.notEqual(cases[1]?.recoveredAmountPaise, cases[1]?.amountPaise);
  assert.notEqual(cases[1]?.classification, "RECOVERED");
});

test("I. query is read-only and merchant-scoped", async () => {
  const harness = createStore([]);

  await loadRecoveryPortfolio(harness.store);

  assert.deepEqual(harness.findManyArgs?.where, {
    order: { merchantId: DEMO_MERCHANT_ID },
  });
  assert.deepEqual(harness.writes, []);
});

test("J. newest sessions are requested first", async () => {
  const harness = createStore([]);

  await loadRecoveryPortfolio(harness.store);

  assert.deepEqual(harness.findManyArgs?.orderBy, { createdAt: "desc" });
});
