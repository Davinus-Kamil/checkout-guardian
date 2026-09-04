import { DEMO_MERCHANT_ID } from "../merchants/demo-merchant.ts";
import {
  deriveRecoveryPortfolioClassification,
  type RecoveryPortfolioClassification,
} from "./derive-recovery-portfolio.ts";

const latestDecisionSelect = {
  id: true,
  paymentState: true,
  failureCategory: true,
  policyResult: true,
  policyReason: true,
  outcome: true,
  recoveredAmount: true,
} as const;

const recoverySessionSelect = {
  id: true,
  orderId: true,
  originalPaymentId: true,
  status: true,
  attemptCount: true,
  order: {
    select: {
      id: true,
      amount: true,
    },
  },
  originalPayment: {
    select: {
      id: true,
      guardianState: true,
      failureCategory: true,
    },
  },
  decisions: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: latestDecisionSelect,
  },
} as const;

type LoadedLatestDecision = {
  id: string;
  paymentState: string;
  failureCategory: string | null;
  policyResult: string | null;
  policyReason: string | null;
  outcome: string | null;
  recoveredAmount: number | null;
};

type LoadedRecoverySession = {
  id: string;
  orderId: string;
  originalPaymentId: string;
  status: string;
  attemptCount: number;
  order: {
    id: string;
    amount: number;
  } | null;
  originalPayment: {
    id: string;
    guardianState: string;
    failureCategory: string | null;
  } | null;
  decisions: LoadedLatestDecision[];
};

export type RecoveryPortfolioStore = {
  recoverySession: {
    findMany: (args: {
      where: { order: { merchantId: string } };
      orderBy: { createdAt: "desc" };
      select: typeof recoverySessionSelect;
    }) => Promise<LoadedRecoverySession[]>;
  };
};

export type RecoveryPortfolioCase = {
  recoverySessionId: string;
  orderId: string;
  originalPaymentId: string;
  latestDecisionId: string | null;
  amountPaise: number;
  classification: RecoveryPortfolioClassification;
  sessionStatus: string;
  paymentState: string;
  failureCategory: string | null;
  policyResult: string | null;
  policyReason: string | null;
  outcome: string | null;
  recoveredAmountPaise: number | null;
  attemptCount: number;
};

function persistedIntegerAmount(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

function mapSession(session: LoadedRecoverySession): RecoveryPortfolioCase | null {
  if (!session.order || !session.originalPayment) {
    return null;
  }

  const decision = session.decisions[0] ?? null;
  const paymentState = decision
    ? decision.paymentState
    : session.originalPayment.guardianState;
  const failureCategory = decision
    ? decision.failureCategory
    : session.originalPayment.failureCategory;
  const recoveredAmount = decision ? decision.recoveredAmount : null;
  const recoveredAmountPaise = persistedIntegerAmount(recoveredAmount);

  return {
    recoverySessionId: session.id,
    orderId: session.order.id,
    originalPaymentId: session.originalPayment.id,
    latestDecisionId: decision?.id ?? null,
    amountPaise: session.order.amount,
    classification: deriveRecoveryPortfolioClassification({
      sessionStatus: session.status,
      paymentState,
      failureCategory,
      policyResult: decision?.policyResult ?? null,
      policyReason: decision?.policyReason ?? null,
      outcome: decision?.outcome ?? null,
      recoveredAmount,
      attemptCount: session.attemptCount,
    }),
    sessionStatus: session.status,
    paymentState,
    failureCategory,
    policyResult: decision?.policyResult ?? null,
    policyReason: decision?.policyReason ?? null,
    outcome: decision?.outcome ?? null,
    recoveredAmountPaise,
    attemptCount: session.attemptCount,
  };
}

async function loadFromStore(
  store: RecoveryPortfolioStore,
): Promise<RecoveryPortfolioCase[]> {
  const sessions = await store.recoverySession.findMany({
    where: { order: { merchantId: DEMO_MERCHANT_ID } },
    orderBy: { createdAt: "desc" },
    select: recoverySessionSelect,
  });

  return sessions.flatMap((session) => {
    const mapped = mapSession(session);
    return mapped ? [mapped] : [];
  });
}

export async function loadRecoveryPortfolio(
  store?: RecoveryPortfolioStore,
): Promise<RecoveryPortfolioCase[]> {
  if (store) {
    return loadFromStore(store);
  }

  const { prisma } = await import("../prisma.ts");
  return loadFromStore(prisma as unknown as RecoveryPortfolioStore);
}
