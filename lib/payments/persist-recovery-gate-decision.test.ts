import assert from "node:assert/strict";
import { test } from "node:test";
import type { PolicyGateResult } from "./evaluate-recovery-policy.ts";
import type { RecoveryProposalResult } from "./propose-recovery-action.ts";
import {
  persistRecoveryGateDecision,
  type PersistRecoveryGateDecisionInput,
  type PersistRecoveryGateDecisionStore,
  type PersistRecoveryGateTx,
} from "./persist-recovery-gate-decision.ts";

const PAYMENT_ID = "pay_internal_1";
const ORDER_ID = "ord_internal_1";
const SESSION_ID = "rsess_1";
const OTHER_SESSION_ID = "rsess_other";

const validProposal: RecoveryProposalResult = {
  proposed: true,
  action: "REOPEN_CHECKOUT",
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
};

const allowGate: PolicyGateResult = {
  allowed: true,
  action: "REOPEN_CHECKOUT",
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
};

const blockMaxAttemptsGate: PolicyGateResult = {
  allowed: false,
  action: "REOPEN_CHECKOUT",
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
  reason: "MAX_ATTEMPTS_REACHED",
};

type SessionRow = {
  id: string;
  orderId: string;
  originalPaymentId: string;
  status: string;
  attemptCount: number;
};

type DecisionRow = {
  id: string;
  recoverySessionId: string;
  paymentId: string;
  failureCategory: string | null;
  paymentState: string;
  proposedAction: string;
  proposalReason: string | null;
  policyResult: string | null;
  policyReason: string | null;
  executedAction: string | null;
  outcome: string | null;
  recoveredAmount: number | null;
};

function allowInput(
  recoverySessionId: string | null,
): PersistRecoveryGateDecisionInput {
  return {
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    recoverySessionId,
    proposal: validProposal,
    gate: allowGate,
  };
}

function createStore(existing: {
  sessions?: SessionRow[];
  decisions?: DecisionRow[];
} = {}) {
  const sessions: SessionRow[] = (existing.sessions ?? []).map((session) => ({
    ...session,
  }));
  const decisions: DecisionRow[] = (existing.decisions ?? []).map((decision) => ({
    ...decision,
  }));
  const writes: string[] = [];
  const upsertCalls: Array<{
    where: { originalPaymentId: string };
    create: {
      orderId: string;
      originalPaymentId: string;
      status: string;
      attemptCount: number;
    };
    update: Record<string, unknown>;
  }> = [];
  let sessionUpdates = 0;
  let nextSession = 1;
  let nextDecision = decisions.length + 1;

  const tx: PersistRecoveryGateTx & {
    recoverySession: PersistRecoveryGateTx["recoverySession"] & {
      update: (args: unknown) => Promise<never>;
      create: (args: unknown) => Promise<never>;
    };
  } = {
    recoverySession: {
      findUnique: async (args) => {
        if ("id" in args.where) {
          return sessions.find((session) => session.id === args.where.id) ?? null;
        }

        return (
          sessions.find(
            (session) => session.originalPaymentId === args.where.originalPaymentId,
          ) ?? null
        );
      },
      upsert: async (args) => {
        upsertCalls.push({
          where: args.where,
          create: args.create,
          update: args.update,
        });
        writes.push("recoverySession.upsert");

        const existingSession = sessions.find(
          (session) => session.originalPaymentId === args.where.originalPaymentId,
        );

        if (existingSession) {
          assert.deepEqual(args.update, {});
          return existingSession;
        }

        const created: SessionRow = {
          id: `rsess_created_${nextSession++}`,
          orderId: args.create.orderId,
          originalPaymentId: args.create.originalPaymentId,
          status: args.create.status,
          attemptCount: args.create.attemptCount,
        };
        sessions.push(created);
        return created;
      },
      update: async () => {
        sessionUpdates += 1;
        writes.push("recoverySession.update");
        throw new Error("unexpected recoverySession.update");
      },
      create: async () => {
        writes.push("recoverySession.create");
        throw new Error("unexpected recoverySession.create");
      },
    },
    decision: {
      create: async (args) => {
        writes.push("decision.create");
        const created: DecisionRow = {
          id: `dec_${nextDecision++}`,
          ...args.data,
        };
        decisions.push(created);
        return { id: created.id };
      },
    },
  };

  const store: PersistRecoveryGateDecisionStore = {
    $transaction: async (fn) => fn(tx),
  };

  return {
    store,
    sessions,
    decisions,
    writes,
    upsertCalls,
    get sessionUpdates() {
      return sessionUpdates;
    },
  };
}

test("1. valid ALLOW + no session creates OPEN session and ALLOW Decision", async () => {
  const harness = createStore();

  const result = await persistRecoveryGateDecision(
    allowInput(null),
    harness.store,
  );

  assert.equal(result.persisted, true);
  if (!result.persisted) {
    return;
  }

  assert.equal(harness.sessions.length, 1);
  assert.equal(harness.sessions[0]?.status, "OPEN");
  assert.equal(harness.sessions[0]?.attemptCount, 0);
  assert.equal(harness.sessions[0]?.originalPaymentId, PAYMENT_ID);
  assert.equal(harness.sessions[0]?.orderId, ORDER_ID);
  assert.equal(result.recoverySessionId, harness.sessions[0]?.id);
  assert.equal(harness.decisions.length, 1);
  assert.equal(harness.decisions[0]?.policyResult, "ALLOW");
  assert.equal(harness.decisions[0]?.executedAction, null);
  assert.equal(harness.decisions[0]?.outcome, null);
  assert.equal(harness.decisions[0]?.recoveredAmount, null);
});

test("2. valid BLOCK MAX_ATTEMPTS_REACHED reuses session and creates second Decision", async () => {
  const harness = createStore({
    sessions: [
      {
        id: SESSION_ID,
        orderId: ORDER_ID,
        originalPaymentId: PAYMENT_ID,
        status: "OPEN",
        attemptCount: 1,
      },
    ],
    decisions: [
      {
        id: "dec_1",
        recoverySessionId: SESSION_ID,
        paymentId: PAYMENT_ID,
        failureCategory: "GENERIC_PAYMENT_FAILED",
        paymentState: "FAILED",
        proposedAction: "REOPEN_CHECKOUT",
        proposalReason: null,
        policyResult: "ALLOW",
        policyReason: null,
        executedAction: null,
        outcome: null,
        recoveredAmount: null,
      },
    ],
  });

  const result = await persistRecoveryGateDecision(
    {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      recoverySessionId: SESSION_ID,
      proposal: validProposal,
      gate: blockMaxAttemptsGate,
    },
    harness.store,
  );

  assert.equal(result.persisted, true);
  if (!result.persisted) {
    return;
  }

  assert.equal(harness.sessions.length, 1);
  assert.equal(harness.sessions[0]?.id, SESSION_ID);
  assert.equal(harness.sessions[0]?.attemptCount, 1);
  assert.equal(harness.upsertCalls.length, 0);
  assert.equal(harness.decisions.length, 2);
  assert.equal(harness.decisions[1]?.policyResult, "BLOCK");
  assert.equal(harness.decisions[1]?.policyReason, "MAX_ATTEMPTS_REACHED");
  assert.equal(harness.decisions[1]?.recoverySessionId, SESSION_ID);
});

test("3. no proposal performs no writes", async () => {
  const harness = createStore();

  const result = await persistRecoveryGateDecision(
    {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      recoverySessionId: null,
      proposal: {
        proposed: false,
        action: null,
        guardianState: "UNRESOLVED",
        failureCategory: null,
        reason: "NOT_VERIFIED",
      },
      gate: {
        allowed: false,
        action: null,
        guardianState: "UNRESOLVED",
        failureCategory: null,
        reason: "NO_PROPOSAL",
      },
    },
    harness.store,
  );

  assert.deepEqual(result, {
    persisted: false,
    reason: "NO_PROPOSAL",
  });
  assert.deepEqual(harness.writes, []);
  assert.equal(harness.sessions.length, 0);
  assert.equal(harness.decisions.length, 0);
});

test("4. malformed proposal action performs no writes", async () => {
  const harness = createStore();

  const result = await persistRecoveryGateDecision(
    {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      recoverySessionId: null,
      proposal: {
        proposed: true,
        action: "RETRY_PAYMENT",
        guardianState: "FAILED",
        failureCategory: "GENERIC_PAYMENT_FAILED",
      } as RecoveryProposalResult,
      gate: allowGate,
    },
    harness.store,
  );

  assert.deepEqual(result, {
    persisted: false,
    reason: "INVALID_INPUT",
  });
  assert.deepEqual(harness.writes, []);
});

test("5. inconsistent Gate action/state/category performs no writes", async () => {
  const harness = createStore();

  const result = await persistRecoveryGateDecision(
    {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      recoverySessionId: null,
      proposal: validProposal,
      gate: {
        allowed: true,
        action: "REOPEN_CHECKOUT",
        guardianState: "SUCCESS",
        failureCategory: "GENERIC_PAYMENT_FAILED",
      } as PolicyGateResult,
    },
    harness.store,
  );

  assert.deepEqual(result, {
    persisted: false,
    reason: "INCONSISTENT_GATE",
  });
  assert.deepEqual(harness.writes, []);
});

test("6. existing session mismatch with payment/order writes no Decision", async () => {
  const harness = createStore({
    sessions: [
      {
        id: OTHER_SESSION_ID,
        orderId: "ord_other",
        originalPaymentId: "pay_other",
        status: "OPEN",
        attemptCount: 0,
      },
    ],
  });

  const result = await persistRecoveryGateDecision(
    {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      recoverySessionId: OTHER_SESSION_ID,
      proposal: validProposal,
      gate: allowGate,
    },
    harness.store,
  );

  assert.deepEqual(result, {
    persisted: false,
    reason: "SESSION_MISMATCH",
  });
  assert.equal(harness.decisions.length, 0);
  assert.equal(harness.writes.includes("decision.create"), false);
});

test("7. concurrent-safe creation uses unique originalPaymentId upsert", async () => {
  const harness = createStore();

  const result = await persistRecoveryGateDecision(
    allowInput(null),
    harness.store,
  );

  assert.equal(result.persisted, true);
  assert.equal(harness.upsertCalls.length, 1);
  assert.deepEqual(harness.upsertCalls[0]?.where, {
    originalPaymentId: PAYMENT_ID,
  });
  assert.deepEqual(harness.upsertCalls[0]?.create, {
    orderId: ORDER_ID,
    originalPaymentId: PAYMENT_ID,
    status: "OPEN",
    attemptCount: 0,
  });
  assert.deepEqual(harness.upsertCalls[0]?.update, {});
});

test("8. ALLOW Decision stores proposal and null execution fields", async () => {
  const harness = createStore();

  const result = await persistRecoveryGateDecision(
    allowInput(null),
    harness.store,
  );

  assert.equal(result.persisted, true);
  const decision = harness.decisions[0];
  assert.deepEqual(decision, {
    id: decision?.id,
    recoverySessionId: harness.sessions[0]?.id,
    paymentId: PAYMENT_ID,
    failureCategory: "GENERIC_PAYMENT_FAILED",
    paymentState: "FAILED",
    proposedAction: "REOPEN_CHECKOUT",
    proposalReason: null,
    policyResult: "ALLOW",
    policyReason: null,
    executedAction: null,
    outcome: null,
    recoveredAmount: null,
  });
});

test("9. BLOCK Decision stores exact M13 reason", async () => {
  const harness = createStore({
    sessions: [
      {
        id: SESSION_ID,
        orderId: ORDER_ID,
        originalPaymentId: PAYMENT_ID,
        status: "OPEN",
        attemptCount: 0,
      },
    ],
  });

  const result = await persistRecoveryGateDecision(
    {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      recoverySessionId: SESSION_ID,
      proposal: validProposal,
      gate: {
        allowed: false,
        action: "REOPEN_CHECKOUT",
        guardianState: "FAILED",
        failureCategory: "GENERIC_PAYMENT_FAILED",
        reason: "MISSING_POLICY",
      },
    },
    harness.store,
  );

  assert.equal(result.persisted, true);
  assert.equal(harness.decisions[0]?.policyResult, "BLOCK");
  assert.equal(harness.decisions[0]?.policyReason, "MISSING_POLICY");
});

test("10. helper does not increment attemptCount or change session status after creation", async () => {
  const harness = createStore({
    sessions: [
      {
        id: SESSION_ID,
        orderId: ORDER_ID,
        originalPaymentId: PAYMENT_ID,
        status: "OPEN",
        attemptCount: 2,
      },
    ],
  });

  const created = await persistRecoveryGateDecision(
    allowInput(null),
    harness.store,
  );

  assert.equal(created.persisted, true);
  assert.equal(harness.sessions[0]?.attemptCount, 2);
  assert.equal(harness.sessions[0]?.status, "OPEN");
  assert.equal(harness.sessionUpdates, 0);
  assert.deepEqual(harness.upsertCalls[0]?.update, {});
  assert.equal("attemptCount" in (harness.upsertCalls[0]?.update ?? {}), false);
  assert.equal("status" in (harness.upsertCalls[0]?.update ?? {}), false);
});

const unresolvedConsideredProposal: RecoveryProposalResult = {
  proposed: true,
  action: "REOPEN_CHECKOUT",
  guardianState: "UNRESOLVED",
  failureCategory: null,
};

const confirmedFailureRequiredGate: PolicyGateResult = {
  allowed: false,
  action: "REOPEN_CHECKOUT",
  guardianState: "UNRESOLVED",
  failureCategory: null,
  reason: "CONFIRMED_FAILURE_REQUIRED",
};

test("B. Scenario B BLOCK Decision stores UNRESOLVED truthfully", async () => {
  const harness = createStore();

  const result = await persistRecoveryGateDecision(
    {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      recoverySessionId: null,
      proposal: unresolvedConsideredProposal,
      gate: confirmedFailureRequiredGate,
    },
    harness.store,
  );

  assert.equal(result.persisted, true);
  if (!result.persisted) {
    return;
  }

  assert.equal(result.policyResult, "BLOCK");
  assert.equal(result.policyReason, "CONFIRMED_FAILURE_REQUIRED");
  assert.equal(harness.decisions.length, 1);
  assert.deepEqual(harness.decisions[0], {
    id: harness.decisions[0]?.id,
    recoverySessionId: harness.sessions[0]?.id,
    paymentId: PAYMENT_ID,
    failureCategory: null,
    paymentState: "UNRESOLVED",
    proposedAction: "REOPEN_CHECKOUT",
    proposalReason: null,
    policyResult: "BLOCK",
    policyReason: "CONFIRMED_FAILURE_REQUIRED",
    executedAction: null,
    outcome: null,
    recoveredAmount: null,
  });
});

test("C. Scenario B BLOCK persistence does not increment attemptCount", async () => {
  const harness = createStore({
    sessions: [
      {
        id: SESSION_ID,
        orderId: ORDER_ID,
        originalPaymentId: PAYMENT_ID,
        status: "OPEN",
        attemptCount: 0,
      },
    ],
  });

  const result = await persistRecoveryGateDecision(
    {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      recoverySessionId: SESSION_ID,
      proposal: unresolvedConsideredProposal,
      gate: confirmedFailureRequiredGate,
    },
    harness.store,
  );

  assert.equal(result.persisted, true);
  assert.equal(harness.sessions.length, 1);
  assert.equal(harness.sessions[0]?.attemptCount, 0);
  assert.equal(harness.sessions[0]?.status, "OPEN");
  assert.equal(harness.sessionUpdates, 0);
  assert.equal(harness.upsertCalls.length, 0);
});
