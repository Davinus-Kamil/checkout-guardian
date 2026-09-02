export type FinalizeAuthorizedRecoveryInput = {
  orderId: string;
  successfulPaymentId: string;
};

export type FinalizeAuthorizedRecoveryFailureReason =
  | "INVALID_INPUT"
  | "NOT_RECOVERY"
  | "AMBIGUOUS"
  | "INCONSISTENT";

export type FinalizeAuthorizedRecoveryResult =
  | {
      finalized: true;
      recoveredAmount: number;
      currency: string;
    }
  | {
      finalized: false;
      reason: FinalizeAuthorizedRecoveryFailureReason;
    };

type OrderRow = {
  id: string;
  amount: number;
  currency: string;
};

type PaymentRow = {
  id: string;
  orderId: string;
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
  paymentState: string;
  policyResult: string | null;
  executedAction: string | null;
  outcome: string | null;
  recoveredAmount: number | null;
};

type LoadedSession = SessionRow & {
  originalPayment: PaymentRow | null;
  decisions: DecisionRow[];
};

export type FinalizeAuthorizedRecoveryTx = {
  decision: {
    updateMany: (args: {
      where: {
        id: string;
        recoverySessionId: string;
        paymentId: string;
        paymentState: "FAILED";
        policyResult: "ALLOW";
        executedAction: "REOPEN_CHECKOUT";
        outcome: null;
      };
      data: {
        outcome: "RECOVERED";
        recoveredAmount: number;
      };
    }) => Promise<{ count: number }>;
  };
  recoverySession: {
    updateMany: (args: {
      where: {
        id: string;
        orderId: string;
        originalPaymentId: string;
        status: "IN_PROGRESS";
        attemptCount: { gt: 0 };
      };
      data: {
        status: "COMPLETED";
      };
    }) => Promise<{ count: number }>;
  };
};

export type FinalizeAuthorizedRecoveryStore = {
  order: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id: true;
        amount: true;
        currency: true;
      };
    }) => Promise<OrderRow | null>;
  };
  payment: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id: true;
        orderId: true;
      };
    }) => Promise<PaymentRow | null>;
  };
  recoverySession: {
    findMany: (args: {
      where: { orderId: string };
      select: {
        id: true;
        orderId: true;
        originalPaymentId: true;
        status: true;
        attemptCount: true;
        originalPayment: {
          select: {
            id: true;
            orderId: true;
          };
        };
        decisions: {
          select: {
            id: true;
            recoverySessionId: true;
            paymentId: true;
            paymentState: true;
            policyResult: true;
            executedAction: true;
            outcome: true;
            recoveredAmount: true;
          };
        };
      };
    }) => Promise<LoadedSession[]>;
  };
  $transaction: <T>(
    fn: (tx: FinalizeAuthorizedRecoveryTx) => Promise<T>,
  ) => Promise<T>;
};

const sessionGraphSelect = {
  id: true,
  orderId: true,
  originalPaymentId: true,
  status: true,
  attemptCount: true,
  originalPayment: {
    select: {
      id: true,
      orderId: true,
    },
  },
  decisions: {
    select: {
      id: true,
      recoverySessionId: true,
      paymentId: true,
      paymentState: true,
      policyResult: true,
      executedAction: true,
      outcome: true,
      recoveredAmount: true,
    },
  },
} as const;

function skipped(
  reason: FinalizeAuthorizedRecoveryFailureReason,
): FinalizeAuthorizedRecoveryResult {
  return { finalized: false, reason };
}

function isUsableOrderAmount(amount: number, currency: string): boolean {
  return (
    Number.isInteger(amount) &&
    amount > 0 &&
    typeof currency === "string" &&
    currency.trim().length > 0
  );
}

function isAuthorizedExecutedDecision(decision: DecisionRow): boolean {
  return (
    decision.paymentState === "FAILED" &&
    decision.policyResult === "ALLOW" &&
    decision.executedAction === "REOPEN_CHECKOUT" &&
    decision.paymentId.trim().length > 0
  );
}

function isEligibleOpenDecision(
  decision: DecisionRow,
  originalPaymentId: string,
): boolean {
  return (
    isAuthorizedExecutedDecision(decision) &&
    decision.recoverySessionId.trim().length > 0 &&
    decision.paymentId === originalPaymentId &&
    decision.outcome === null
  );
}

function isMatchingFinalizedDecision(
  decision: DecisionRow,
  originalPaymentId: string,
  recoveredAmount: number,
): boolean {
  return (
    isAuthorizedExecutedDecision(decision) &&
    decision.paymentId === originalPaymentId &&
    decision.outcome === "RECOVERED" &&
    decision.recoveredAmount === recoveredAmount
  );
}

function sessionBelongsToOrder(
  session: LoadedSession,
  orderId: string,
  successfulPaymentId: string,
): boolean {
  return (
    session.orderId === orderId &&
    session.originalPaymentId !== successfulPaymentId &&
    session.originalPayment !== null &&
    session.originalPayment.id === session.originalPaymentId &&
    session.originalPayment.orderId === orderId
  );
}

type ClassifiedCandidates = {
  eligible: Array<{ session: LoadedSession; decision: DecisionRow }>;
  alreadyFinalized: Array<{ session: LoadedSession; decision: DecisionRow }>;
  inconsistent: boolean;
};

function classifySessions(
  sessions: LoadedSession[],
  orderId: string,
  successfulPaymentId: string,
  recoveredAmount: number,
): ClassifiedCandidates {
  const eligible: ClassifiedCandidates["eligible"] = [];
  const alreadyFinalized: ClassifiedCandidates["alreadyFinalized"] = [];
  let inconsistent = false;

  // Frozen MVP has no recoveredPaymentId. Infer at most one authorized
  // session on this Order; more than one is ambiguous and must fail closed.

  for (const session of sessions) {
    if (!sessionBelongsToOrder(session, orderId, successfulPaymentId)) {
      continue;
    }

    const matchingDecisions = session.decisions.filter(
      (decision) => decision.recoverySessionId === session.id,
    );

    const openMatches = matchingDecisions.filter((decision) =>
      isEligibleOpenDecision(decision, session.originalPaymentId),
    );
    const finalizedMatches = matchingDecisions.filter((decision) =>
      isMatchingFinalizedDecision(
        decision,
        session.originalPaymentId,
        recoveredAmount,
      ),
    );
    const hasRecoveredOutcome = matchingDecisions.some(
      (decision) => decision.outcome === "RECOVERED",
    );

    if (session.status === "COMPLETED" || hasRecoveredOutcome) {
      if (
        session.status === "COMPLETED" &&
        finalizedMatches.length === 1 &&
        openMatches.length === 0
      ) {
        alreadyFinalized.push({ session, decision: finalizedMatches[0] });
        continue;
      }

      inconsistent = true;
      continue;
    }

    if (session.status === "IN_PROGRESS" && session.attemptCount > 0) {
      if (openMatches.length === 1) {
        eligible.push({ session, decision: openMatches[0] });
        continue;
      }

      inconsistent = true;
    }
  }

  return { eligible, alreadyFinalized, inconsistent };
}

async function claimFinalization(
  tx: FinalizeAuthorizedRecoveryTx,
  input: {
    session: LoadedSession;
    decision: DecisionRow;
    orderId: string;
    recoveredAmount: number;
  },
): Promise<boolean> {
  const claimedDecision = await tx.decision.updateMany({
    where: {
      id: input.decision.id,
      recoverySessionId: input.session.id,
      paymentId: input.session.originalPaymentId,
      paymentState: "FAILED",
      policyResult: "ALLOW",
      executedAction: "REOPEN_CHECKOUT",
      outcome: null,
    },
    data: {
      outcome: "RECOVERED",
      recoveredAmount: input.recoveredAmount,
    },
  });

  if (claimedDecision.count !== 1) {
    return false;
  }

  const claimedSession = await tx.recoverySession.updateMany({
    where: {
      id: input.session.id,
      orderId: input.orderId,
      originalPaymentId: input.session.originalPaymentId,
      status: "IN_PROGRESS",
      attemptCount: { gt: 0 },
    },
    data: {
      status: "COMPLETED",
    },
  });

  if (claimedSession.count !== 1) {
    throw new Error("RECOVERY_FINALIZATION_PARTIAL_CLAIM");
  }

  return true;
}

async function finalizeWithStore(
  input: FinalizeAuthorizedRecoveryInput,
  store: FinalizeAuthorizedRecoveryStore,
): Promise<FinalizeAuthorizedRecoveryResult> {
  if (!input.orderId.trim() || !input.successfulPaymentId.trim()) {
    return skipped("INVALID_INPUT");
  }

  const order = await store.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      amount: true,
      currency: true,
    },
  });

  if (!order || !isUsableOrderAmount(order.amount, order.currency)) {
    return skipped("INCONSISTENT");
  }

  const successfulPayment = await store.payment.findUnique({
    where: { id: input.successfulPaymentId },
    select: {
      id: true,
      orderId: true,
    },
  });

  if (!successfulPayment || successfulPayment.orderId !== input.orderId) {
    return skipped("INCONSISTENT");
  }

  const sessions = await store.recoverySession.findMany({
    where: { orderId: input.orderId },
    select: sessionGraphSelect,
  });

  const classified = classifySessions(
    sessions,
    input.orderId,
    input.successfulPaymentId,
    order.amount,
  );

  if (classified.inconsistent) {
    return skipped("INCONSISTENT");
  }

  if (classified.eligible.length + classified.alreadyFinalized.length > 1) {
    return skipped("AMBIGUOUS");
  }

  if (classified.alreadyFinalized.length === 1 && classified.eligible.length === 0) {
    return {
      finalized: true,
      recoveredAmount: order.amount,
      currency: order.currency,
    };
  }

  if (classified.eligible.length === 0) {
    return skipped("NOT_RECOVERY");
  }

  const candidate = classified.eligible[0];

  try {
    const claimed = await store.$transaction((tx) =>
      claimFinalization(tx, {
        session: candidate.session,
        decision: candidate.decision,
        orderId: input.orderId,
        recoveredAmount: order.amount,
      }),
    );

    if (!claimed) {
      const replayed = await store.recoverySession.findMany({
        where: { orderId: input.orderId },
        select: sessionGraphSelect,
      });
      const again = classifySessions(
        replayed,
        input.orderId,
        input.successfulPaymentId,
        order.amount,
      );

      if (
        !again.inconsistent &&
        again.eligible.length === 0 &&
        again.alreadyFinalized.length === 1
      ) {
        return {
          finalized: true,
          recoveredAmount: order.amount,
          currency: order.currency,
        };
      }

      return skipped(again.eligible.length > 1 ? "AMBIGUOUS" : "INCONSISTENT");
    }
  } catch {
    return skipped("INCONSISTENT");
  }

  return {
    finalized: true,
    recoveredAmount: order.amount,
    currency: order.currency,
  };
}

export async function finalizeAuthorizedRecovery(
  input: FinalizeAuthorizedRecoveryInput,
  store?: FinalizeAuthorizedRecoveryStore,
): Promise<FinalizeAuthorizedRecoveryResult> {
  if (store) {
    return finalizeWithStore(input, store);
  }

  const { prisma } = await import("../prisma.ts");
  return finalizeWithStore(input, prisma as unknown as FinalizeAuthorizedRecoveryStore);
}
