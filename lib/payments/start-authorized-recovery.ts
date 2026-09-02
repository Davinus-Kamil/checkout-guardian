export type StartAuthorizedRecoveryInput = {
  recoverySessionId: string;
  decisionId: string;
};

export type StartRecoveryAttemptFailureReason =
  | "INVALID_INPUT"
  | "SESSION_NOT_FOUND"
  | "DECISION_NOT_FOUND"
  | "DECISION_SESSION_MISMATCH"
  | "NOT_AUTHORIZED"
  | "ALREADY_STARTED";

export type StartRecoveryAttemptResult =
  | {
      started: true;
      recoverySessionId: string;
      decisionId: string;
      action: "REOPEN_CHECKOUT";
      attemptCount: number;
      sessionStatus: "IN_PROGRESS";
    }
  | {
      started: false;
      reason: StartRecoveryAttemptFailureReason;
    };

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

const sessionSelect = {
  id: true,
  status: true,
  attemptCount: true,
} as const;

const decisionSelect = {
  id: true,
  recoverySessionId: true,
  policyResult: true,
  proposedAction: true,
  executedAction: true,
  outcome: true,
} as const;

const decisionClaimWhere = {
  policyResult: "ALLOW",
  proposedAction: "REOPEN_CHECKOUT",
  executedAction: null,
  outcome: null,
} as const;

export type StartAuthorizedRecoveryTx = {
  recoverySession: {
    findUnique: (args: {
      where: { id: string };
      select: typeof sessionSelect;
    }) => Promise<SessionRow | null>;
    update: (args: {
      where: { id: string };
      data: {
        attemptCount: { increment: 1 };
        status: "IN_PROGRESS";
      };
      select: {
        attemptCount: true;
        status: true;
      };
    }) => Promise<{ attemptCount: number; status: string }>;
  };
  decision: {
    findUnique: (args: {
      where: { id: string };
      select: typeof decisionSelect;
    }) => Promise<DecisionRow | null>;
    updateMany: (args: {
      where: {
        id: string;
        recoverySessionId: string;
        policyResult: "ALLOW";
        proposedAction: "REOPEN_CHECKOUT";
        executedAction: null;
        outcome: null;
      };
      data: {
        executedAction: "REOPEN_CHECKOUT";
      };
    }) => Promise<{ count: number }>;
  };
};

export type StartAuthorizedRecoveryStore = {
  $transaction: <T>(
    fn: (tx: StartAuthorizedRecoveryTx) => Promise<T>,
  ) => Promise<T>;
};

function failed(
  reason: StartRecoveryAttemptFailureReason,
): StartRecoveryAttemptResult {
  return { started: false, reason };
}

async function startInTransaction(
  tx: StartAuthorizedRecoveryTx,
  input: StartAuthorizedRecoveryInput,
): Promise<StartRecoveryAttemptResult> {
  const session = await tx.recoverySession.findUnique({
    where: { id: input.recoverySessionId },
    select: sessionSelect,
  });

  if (!session) {
    return failed("SESSION_NOT_FOUND");
  }

  const decision = await tx.decision.findUnique({
    where: { id: input.decisionId },
    select: decisionSelect,
  });

  if (!decision) {
    return failed("DECISION_NOT_FOUND");
  }

  if (decision.recoverySessionId !== input.recoverySessionId) {
    return failed("DECISION_SESSION_MISMATCH");
  }

  if (
    decision.policyResult !== "ALLOW" ||
    decision.proposedAction !== "REOPEN_CHECKOUT"
  ) {
    return failed("NOT_AUTHORIZED");
  }

  if (decision.executedAction !== null || decision.outcome !== null) {
    return failed("ALREADY_STARTED");
  }

  const claimed = await tx.decision.updateMany({
    where: {
      id: input.decisionId,
      recoverySessionId: input.recoverySessionId,
      ...decisionClaimWhere,
    },
    data: {
      executedAction: "REOPEN_CHECKOUT",
    },
  });

  if (claimed.count !== 1) {
    return failed("ALREADY_STARTED");
  }

  const updatedSession = await tx.recoverySession.update({
    where: { id: input.recoverySessionId },
    data: {
      attemptCount: { increment: 1 },
      status: "IN_PROGRESS",
    },
    select: {
      attemptCount: true,
      status: true,
    },
  });

  return {
    started: true,
    recoverySessionId: session.id,
    decisionId: decision.id,
    action: "REOPEN_CHECKOUT",
    attemptCount: updatedSession.attemptCount,
    sessionStatus: "IN_PROGRESS",
  };
}

export async function startAuthorizedRecovery(
  input: StartAuthorizedRecoveryInput,
  store?: StartAuthorizedRecoveryStore,
): Promise<StartRecoveryAttemptResult> {
  if (!input.recoverySessionId.trim() || !input.decisionId.trim()) {
    return failed("INVALID_INPUT");
  }

  if (store) {
    return store.$transaction((tx) => startInTransaction(tx, input));
  }

  const { prisma } = await import("../prisma.ts");
  return prisma.$transaction((tx) =>
    startInTransaction(tx as unknown as StartAuthorizedRecoveryTx, input),
  );
}
