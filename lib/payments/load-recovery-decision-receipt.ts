import {
  deriveRecoveryDecisionReceipt,
  type RecoveryDecisionReceipt,
} from "./derive-recovery-decision-receipt.ts";

export type RecoveryDecisionReceiptLoadFailureReason =
  | "INVALID_DECISION_ID"
  | "DECISION_NOT_FOUND"
  | "INCONSISTENT";

export type RecoveryDecisionReceiptLoadResult =
  | {
      ok: true;
      receipt: RecoveryDecisionReceipt;
    }
  | {
      ok: false;
      reason: RecoveryDecisionReceiptLoadFailureReason;
    };

export type RecoveryDecisionReceiptHttpBody =
  | {
      receipt: RecoveryDecisionReceipt;
    }
  | {
      error: RecoveryDecisionReceiptLoadFailureReason;
    };

export function mapRecoveryDecisionReceiptHttp(
  result: RecoveryDecisionReceiptLoadResult,
): {
  status: number;
  body: RecoveryDecisionReceiptHttpBody;
} {
  if (result.ok) {
    return {
      status: 200,
      body: { receipt: result.receipt },
    };
  }

  if (result.reason === "INVALID_DECISION_ID") {
    return {
      status: 400,
      body: { error: result.reason },
    };
  }

  if (result.reason === "DECISION_NOT_FOUND") {
    return {
      status: 404,
      body: { error: result.reason },
    };
  }

  return {
    status: 409,
    body: { error: result.reason },
  };
}

type LoadedDecision = {
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
  createdAt: Date;
};

type LoadedRecoverySession = {
  id: string;
  orderId: string;
  originalPaymentId: string;
  status: string;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type LoadedOrder = {
  id: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  createdAt: Date;
  updatedAt: Date;
};

type LoadedPayment = {
  id: string;
  orderId: string;
  razorpayPaymentId: string;
  method: string | null;
  gatewayStatus: string;
  guardianState: string;
  failureCategory: string | null;
  errorCode: string | null;
  errorReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RecoveryDecisionReceiptStore = {
  decision: {
    findUnique: (args: {
      where: { id: string };
      select: typeof decisionSelect;
    }) => Promise<LoadedDecision | null>;
  };
  recoverySession: {
    findUnique: (args: {
      where: { id: string };
      select: typeof recoverySessionSelect;
    }) => Promise<LoadedRecoverySession | null>;
  };
  order: {
    findUnique: (args: {
      where: { id: string };
      select: typeof orderSelect;
    }) => Promise<LoadedOrder | null>;
  };
  payment: {
    findUnique: (args: {
      where: { id: string };
      select: typeof paymentSelect;
    }) => Promise<LoadedPayment | null>;
    findMany: (args: {
      where: {
        orderId: string;
      };
      select: typeof paymentSelect;
    }) => Promise<LoadedPayment[]>;
  };
};

const decisionSelect = {
  id: true,
  recoverySessionId: true,
  paymentId: true,
  failureCategory: true,
  paymentState: true,
  proposedAction: true,
  proposalReason: true,
  policyResult: true,
  policyReason: true,
  executedAction: true,
  outcome: true,
  recoveredAmount: true,
  createdAt: true,
} as const;

const recoverySessionSelect = {
  id: true,
  orderId: true,
  originalPaymentId: true,
  status: true,
  attemptCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

const orderSelect = {
  id: true,
  amount: true,
  currency: true,
  razorpayOrderId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const paymentSelect = {
  id: true,
  orderId: true,
  razorpayPaymentId: true,
  method: true,
  gatewayStatus: true,
  guardianState: true,
  failureCategory: true,
  errorCode: true,
  errorReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

function failed(
  reason: RecoveryDecisionReceiptLoadFailureReason,
): RecoveryDecisionReceiptLoadResult {
  return { ok: false, reason };
}

async function findDecision(
  decisionId: string,
  store?: RecoveryDecisionReceiptStore,
): Promise<LoadedDecision | null> {
  if (store) {
    return store.decision.findUnique({
      where: { id: decisionId },
      select: decisionSelect,
    });
  }

  const { prisma } = await import("../prisma.ts");

  return prisma.decision.findUnique({
    where: { id: decisionId },
    select: decisionSelect,
  });
}

async function findRecoverySession(
  recoverySessionId: string,
  store?: RecoveryDecisionReceiptStore,
): Promise<LoadedRecoverySession | null> {
  if (store) {
    return store.recoverySession.findUnique({
      where: { id: recoverySessionId },
      select: recoverySessionSelect,
    });
  }

  const { prisma } = await import("../prisma.ts");

  return prisma.recoverySession.findUnique({
    where: { id: recoverySessionId },
    select: recoverySessionSelect,
  });
}

async function findOrder(
  orderId: string,
  store?: RecoveryDecisionReceiptStore,
): Promise<LoadedOrder | null> {
  if (store) {
    return store.order.findUnique({
      where: { id: orderId },
      select: orderSelect,
    });
  }

  const { prisma } = await import("../prisma.ts");

  return prisma.order.findUnique({
    where: { id: orderId },
    select: orderSelect,
  });
}

async function findPayment(
  paymentId: string,
  store?: RecoveryDecisionReceiptStore,
): Promise<LoadedPayment | null> {
  if (store) {
    return store.payment.findUnique({
      where: { id: paymentId },
      select: paymentSelect,
    });
  }

  const { prisma } = await import("../prisma.ts");

  return prisma.payment.findUnique({
    where: { id: paymentId },
    select: paymentSelect,
  });
}

async function findOrderPayments(
  orderId: string,
  store?: RecoveryDecisionReceiptStore,
): Promise<LoadedPayment[]> {
  if (store) {
    return store.payment.findMany({
      where: { orderId },
      select: paymentSelect,
    });
  }

  const { prisma } = await import("../prisma.ts");

  return prisma.payment.findMany({
    where: { orderId },
    select: paymentSelect,
  });
}

function isRecoveredDecision(
  decision: LoadedDecision,
  session: LoadedRecoverySession,
  order: LoadedOrder,
): boolean {
  return (
    decision.paymentState === "FAILED" &&
    decision.failureCategory === "GENERIC_PAYMENT_FAILED" &&
    decision.proposedAction === "REOPEN_CHECKOUT" &&
    decision.policyResult === "ALLOW" &&
    decision.executedAction === "REOPEN_CHECKOUT" &&
    decision.outcome === "RECOVERED" &&
    decision.recoveredAmount === order.amount &&
    session.status === "COMPLETED" &&
    session.attemptCount > 0
  );
}

function isBlockedDecision(
  decision: LoadedDecision,
  session: LoadedRecoverySession,
): boolean {
  return (
    decision.paymentState === "UNRESOLVED" &&
    decision.failureCategory === null &&
    decision.proposedAction === "REOPEN_CHECKOUT" &&
    decision.policyResult === "BLOCK" &&
    decision.policyReason === "CONFIRMED_FAILURE_REQUIRED" &&
    decision.executedAction === null &&
    decision.outcome === null &&
    decision.recoveredAmount === null &&
    session.status === "OPEN" &&
    session.attemptCount === 0
  );
}

export async function loadRecoveryDecisionReceipt(
  decisionId: string,
  store?: RecoveryDecisionReceiptStore,
): Promise<RecoveryDecisionReceiptLoadResult> {
  if (!decisionId.trim()) {
    return failed("INVALID_DECISION_ID");
  }

  const decision = await findDecision(decisionId, store);

  if (!decision) {
    return failed("DECISION_NOT_FOUND");
  }

  const session = await findRecoverySession(
    decision.recoverySessionId,
    store,
  );

  if (!session) {
    return failed("INCONSISTENT");
  }

  if (
    session.id !== decision.recoverySessionId ||
    session.originalPaymentId !== decision.paymentId
  ) {
    return failed("INCONSISTENT");
  }

  const order = await findOrder(session.orderId, store);

  if (!order) {
    return failed("INCONSISTENT");
  }

  const originalPayment = await findPayment(
    session.originalPaymentId,
    store,
  );

  if (!originalPayment) {
    return failed("INCONSISTENT");
  }

  if (
    originalPayment.id !== decision.paymentId ||
    originalPayment.orderId !== order.id
  ) {
    return failed("INCONSISTENT");
  }

  let recoveredPayment: LoadedPayment | null = null;

  if (isRecoveredDecision(decision, session, order)) {
    const payments = await findOrderPayments(order.id, store);

    const candidates = payments.filter(
      (payment) =>
        payment.id !== originalPayment.id &&
        payment.orderId === order.id &&
        payment.guardianState === "SUCCESS" &&
        payment.gatewayStatus === "captured",
    );

    if (candidates.length !== 1) {
      return failed("INCONSISTENT");
    }

    recoveredPayment = candidates[0];
  } else if (!isBlockedDecision(decision, session)) {
    return failed("INCONSISTENT");
  }

  return {
    ok: true,
    receipt: deriveRecoveryDecisionReceipt({
      decision,
      session: {
        id: session.id,
        status: session.status,
        attemptCount: session.attemptCount,
        originalPaymentId: session.originalPaymentId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      order,
      originalPayment: {
        id: originalPayment.id,
        razorpayPaymentId: originalPayment.razorpayPaymentId,
        method: originalPayment.method,
        gatewayStatus: originalPayment.gatewayStatus,
        guardianState: originalPayment.guardianState,
        failureCategory: originalPayment.failureCategory,
        errorCode: originalPayment.errorCode,
        errorReason: originalPayment.errorReason,
        createdAt: originalPayment.createdAt,
        updatedAt: originalPayment.updatedAt,
      },
      recoveredPayment: recoveredPayment
        ? {
            id: recoveredPayment.id,
            razorpayPaymentId: recoveredPayment.razorpayPaymentId,
            method: recoveredPayment.method,
            gatewayStatus: recoveredPayment.gatewayStatus,
            guardianState: recoveredPayment.guardianState,
            failureCategory: recoveredPayment.failureCategory,
            errorCode: recoveredPayment.errorCode,
            errorReason: recoveredPayment.errorReason,
            createdAt: recoveredPayment.createdAt,
            updatedAt: recoveredPayment.updatedAt,
          }
        : null,
    }),
  };
}