import assert from "node:assert/strict";
import { test } from "node:test";
import {
  startAuthorizedRecovery,
  type StartAuthorizedRecoveryStore,
  type StartAuthorizedRecoveryTx,
} from "./start-authorized-recovery.ts";

const SESSION_ID = "rsess_1";
const OTHER_SESSION_ID = "rsess_other";
const DECISION_ID = "dec_1";

type SessionRow = {
  id: string;
  status: string;
  attemptCount: number;
};

type DecisionRow = {
  id: string;
  recoverySessionId: string;
  policyResult: string | null;
  proposedAction: string;
  executedAction: string | null;
  outcome: string | null;
};

function allowDecision(
  overrides: Partial<DecisionRow> = {},
): DecisionRow {
  return {
    id: DECISION_ID,
    recoverySessionId: SESSION_ID,
    policyResult: "ALLOW",
    proposedAction: "REOPEN_CHECKOUT",
    executedAction: null,
    outcome: null,
    ...overrides,
  };
}

function openSession(attemptCount = 0): SessionRow {
  return {
    id: SESSION_ID,
    status: "OPEN",
    attemptCount,
  };
}

function createStore(options: {
  session?: SessionRow | null;
  decision?: DecisionRow | null;
  claimCount?: number;
  throwOnSessionUpdate?: boolean;
} = {}) {
  let session =
    options.session === undefined ? openSession() : options.session;
  let decision =
    options.decision === undefined ? allowDecision() : options.decision;
  const operations: string[] = [];
  const writes: string[] = [];
  let transactionOpened = 0;

  const snapshot = {
    session: session ? { ...session } : null,
    decision: decision ? { ...decision } : null,
  };

  const tx: StartAuthorizedRecoveryTx & {
    recoverySession: StartAuthorizedRecoveryTx["recoverySession"] & {
      create: () => Promise<never>;
      upsert: () => Promise<never>;
    };
    decision: StartAuthorizedRecoveryTx["decision"] & {
      create: () => Promise<never>;
    };
  } = {
    recoverySession: {
      findUnique: async (args) => {
        operations.push("recoverySession.findUnique");
        if (!session || session.id !== args.where.id) {
          return null;
        }
        return { ...session };
      },
      update: async (args) => {
        operations.push("recoverySession.update");
        writes.push("recoverySession.update");
        if (options.throwOnSessionUpdate) {
          throw new Error("session increment failed");
        }
        if (!session || session.id !== args.where.id) {
          throw new Error("RecoverySession not found");
        }
        session = {
          ...session,
          attemptCount: session.attemptCount + args.data.attemptCount.increment,
          status: args.data.status,
        };
        return {
          attemptCount: session.attemptCount,
          status: session.status,
        };
      },
      create: async () => {
        writes.push("recoverySession.create");
        throw new Error("unexpected recoverySession.create");
      },
      upsert: async () => {
        writes.push("recoverySession.upsert");
        throw new Error("unexpected recoverySession.upsert");
      },
    },
    decision: {
      findUnique: async (args) => {
        operations.push("decision.findUnique");
        if (!decision || decision.id !== args.where.id) {
          return null;
        }
        return { ...decision };
      },
      updateMany: async (args) => {
        operations.push("decision.updateMany");
        writes.push("decision.updateMany");

        const matches =
          decision &&
          decision.id === args.where.id &&
          decision.recoverySessionId === args.where.recoverySessionId &&
          decision.policyResult === args.where.policyResult &&
          decision.proposedAction === args.where.proposedAction &&
          decision.executedAction === args.where.executedAction &&
          decision.outcome === args.where.outcome;

        const count = options.claimCount ?? (matches ? 1 : 0);

        if (count === 1 && decision) {
          decision = {
            ...decision,
            executedAction: args.data.executedAction,
          };
        }

        return { count };
      },
      create: async () => {
        writes.push("decision.create");
        throw new Error("unexpected decision.create");
      },
    },
  };

  const store: StartAuthorizedRecoveryStore = {
    $transaction: async (fn) => {
      transactionOpened += 1;
      try {
        return await fn(tx);
      } catch (error) {
        session = snapshot.session ? { ...snapshot.session } : null;
        decision = snapshot.decision ? { ...snapshot.decision } : null;
        throw error;
      }
    },
  };

  return {
    store,
    operations,
    writes,
    get transactionOpened() {
      return transactionOpened;
    },
    get session() {
      return session;
    },
    get decision() {
      return decision;
    },
  };
}

test("1. valid ALLOW Decision + OPEN session starts recovery", async () => {
  const harness = createStore();

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    started: true,
    recoverySessionId: SESSION_ID,
    decisionId: DECISION_ID,
    action: "REOPEN_CHECKOUT",
    attemptCount: 1,
    sessionStatus: "IN_PROGRESS",
  });
  assert.equal(harness.decision?.executedAction, "REOPEN_CHECKOUT");
  assert.equal(harness.session?.attemptCount, 1);
  assert.equal(harness.session?.status, "IN_PROGRESS");
});

test("2. attemptCount 2 becomes 3 and is not reset", async () => {
  const harness = createStore({ session: openSession(2) });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.equal(result.started, true);
  if (!result.started) {
    return;
  }

  assert.equal(result.attemptCount, 3);
  assert.equal(harness.session?.attemptCount, 3);
  assert.notEqual(harness.session?.attemptCount, 1);
});

test("3. BLOCK Decision is NOT_AUTHORIZED with no writes", async () => {
  const harness = createStore({
    decision: allowDecision({ policyResult: "BLOCK" }),
  });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    started: false,
    reason: "NOT_AUTHORIZED",
  });
  assert.deepEqual(harness.writes, []);
  assert.equal(harness.session?.attemptCount, 0);
  assert.equal(harness.decision?.executedAction, null);
});

test("4. wrong proposedAction is NOT_AUTHORIZED with no writes", async () => {
  const harness = createStore({
    decision: allowDecision({ proposedAction: "RETRY_PAYMENT" }),
  });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    started: false,
    reason: "NOT_AUTHORIZED",
  });
  assert.deepEqual(harness.writes, []);
});

test("5. Decision already has executedAction → ALREADY_STARTED, no increment", async () => {
  const harness = createStore({
    session: openSession(1),
    decision: allowDecision({ executedAction: "REOPEN_CHECKOUT" }),
  });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    started: false,
    reason: "ALREADY_STARTED",
  });
  assert.equal(harness.writes.includes("recoverySession.update"), false);
  assert.equal(harness.session?.attemptCount, 1);
});

test("6. Decision already has outcome → fail closed, no increment", async () => {
  const harness = createStore({
    session: openSession(1),
    decision: allowDecision({ outcome: "FAILED" }),
  });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.equal(result.started, false);
  if (result.started) {
    return;
  }

  assert.equal(result.reason, "ALREADY_STARTED");
  assert.equal(harness.writes.includes("recoverySession.update"), false);
  assert.equal(harness.session?.attemptCount, 1);
});

test("7. session missing → SESSION_NOT_FOUND", async () => {
  const harness = createStore({ session: null });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    started: false,
    reason: "SESSION_NOT_FOUND",
  });
});

test("8. Decision missing → DECISION_NOT_FOUND", async () => {
  const harness = createStore({ decision: null });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    started: false,
    reason: "DECISION_NOT_FOUND",
  });
});

test("9. Decision belongs to different session → DECISION_SESSION_MISMATCH", async () => {
  const harness = createStore({
    decision: allowDecision({ recoverySessionId: OTHER_SESSION_ID }),
  });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    started: false,
    reason: "DECISION_SESSION_MISMATCH",
  });
  assert.deepEqual(harness.writes, []);
});

test("10. blank IDs → INVALID_INPUT and no transaction writes", async () => {
  const harness = createStore();

  const result = await startAuthorizedRecovery(
    { recoverySessionId: "   ", decisionId: "  " },
    harness.store,
  );

  assert.deepEqual(result, {
    started: false,
    reason: "INVALID_INPUT",
  });
  assert.equal(harness.transactionOpened, 0);
  assert.deepEqual(harness.writes, []);
});

test("11. conditional Decision claim count 0 → ALREADY_STARTED, session not incremented", async () => {
  const harness = createStore({
    session: openSession(4),
    claimCount: 0,
  });

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.deepEqual(result, {
    started: false,
    reason: "ALREADY_STARTED",
  });
  assert.equal(harness.session?.attemptCount, 4);
  assert.equal(harness.session?.status, "OPEN");
  assert.equal(harness.writes.includes("recoverySession.update"), false);
});

test("12. successful path claims Decision first then increments session in one transaction", async () => {
  const harness = createStore();

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.equal(result.started, true);
  assert.equal(harness.transactionOpened, 1);
  const claimIndex = harness.operations.indexOf("decision.updateMany");
  const sessionIndex = harness.operations.indexOf("recoverySession.update");
  assert.ok(claimIndex >= 0);
  assert.ok(sessionIndex >= 0);
  assert.ok(claimIndex < sessionIndex);
});

test("13. session increment throw after claim rolls back and does not report success", async () => {
  const harness = createStore({ throwOnSessionUpdate: true });

  await assert.rejects(
    () =>
      startAuthorizedRecovery(
        { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
        harness.store,
      ),
    /session increment failed/,
  );

  assert.equal(harness.decision?.executedAction, null);
  assert.equal(harness.session?.attemptCount, 0);
  assert.equal(harness.session?.status, "OPEN");
});

test("14. helper never creates session or Decision", async () => {
  const harness = createStore();

  const result = await startAuthorizedRecovery(
    { recoverySessionId: SESSION_ID, decisionId: DECISION_ID },
    harness.store,
  );

  assert.equal(result.started, true);
  assert.equal(harness.writes.includes("recoverySession.create"), false);
  assert.equal(harness.writes.includes("recoverySession.upsert"), false);
  assert.equal(harness.writes.includes("decision.create"), false);
  assert.equal(typeof (harness.store as never), "object");
});
