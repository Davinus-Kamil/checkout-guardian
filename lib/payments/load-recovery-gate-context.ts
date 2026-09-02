import type { RecoveryPolicyContext } from "./evaluate-recovery-policy.ts";

export type RecoveryGateContextFailureReason =
  | "INVALID_PAYMENT_ID"
  | "PAYMENT_NOT_FOUND"
  | "ORDER_NOT_FOUND";

export type RecoveryGateContextResult =
  | {
      ok: true;
      paymentId: string;
      orderId: string;
      merchantId: string;
      policy: RecoveryPolicyContext | null;
      attemptCount: number;
      recoverySessionId: string | null;
    }
  | {
      ok: false;
      reason: RecoveryGateContextFailureReason;
    };

type LoadedPolicy = {
  requireConfirmedFailure: boolean;
  maxRecoveryAttempts: number;
};

type LoadedPayment = {
  id: string;
  orderId: string;
  order: {
    id: string;
    merchantId: string;
    merchant: {
      id: string;
      policy: LoadedPolicy | null;
    } | null;
  } | null;
};

type LoadedRecoverySession = {
  id: string;
  attemptCount: number;
};

export type RecoveryGateContextStore = {
  payment: {
    findUnique: (args: {
      where: { razorpayPaymentId: string };
      select: {
        id: true;
        orderId: true;
        order: {
          select: {
            id: true;
            merchantId: true;
            merchant: {
              select: {
                id: true;
                policy: {
                  select: {
                    requireConfirmedFailure: true;
                    maxRecoveryAttempts: true;
                  };
                };
              };
            };
          };
        };
      };
    }) => Promise<LoadedPayment | null>;
  };
  recoverySession: {
    findUnique: (args: {
      where: { originalPaymentId: string };
      select: {
        id: true;
        attemptCount: true;
      };
    }) => Promise<LoadedRecoverySession | null>;
  };
};

const paymentSelect = {
  id: true,
  orderId: true,
  order: {
    select: {
      id: true,
      merchantId: true,
      merchant: {
        select: {
          id: true,
          policy: {
            select: {
              requireConfirmedFailure: true,
              maxRecoveryAttempts: true,
            },
          },
        },
      },
    },
  },
} as const;

const recoverySessionSelect = {
  id: true,
  attemptCount: true,
} as const;

function failed(
  reason: RecoveryGateContextFailureReason,
): RecoveryGateContextResult {
  return { ok: false, reason };
}

function projectPolicy(policy: LoadedPolicy | null): RecoveryPolicyContext | null {
  if (!policy) {
    return null;
  }

  return {
    requireConfirmedFailure: policy.requireConfirmedFailure,
    maxRecoveryAttempts: policy.maxRecoveryAttempts,
  };
}

async function findPayment(
  razorpayPaymentId: string,
  store?: RecoveryGateContextStore,
): Promise<LoadedPayment | null> {
  if (store) {
    return store.payment.findUnique({
      where: { razorpayPaymentId },
      select: paymentSelect,
    });
  }

  const { prisma } = await import("../prisma.ts");
  return prisma.payment.findUnique({
    where: { razorpayPaymentId },
    select: paymentSelect,
  });
}

async function findRecoverySession(
  originalPaymentId: string,
  store?: RecoveryGateContextStore,
): Promise<LoadedRecoverySession | null> {
  if (store) {
    return store.recoverySession.findUnique({
      where: { originalPaymentId },
      select: recoverySessionSelect,
    });
  }

  const { prisma } = await import("../prisma.ts");
  return prisma.recoverySession.findUnique({
    where: { originalPaymentId },
    select: recoverySessionSelect,
  });
}

export async function loadRecoveryGateContext(
  razorpayPaymentId: string,
  store?: RecoveryGateContextStore,
): Promise<RecoveryGateContextResult> {
  if (!razorpayPaymentId.trim()) {
    return failed("INVALID_PAYMENT_ID");
  }

  const payment = await findPayment(razorpayPaymentId, store);

  if (!payment) {
    return failed("PAYMENT_NOT_FOUND");
  }

  if (!payment.order) {
    return failed("ORDER_NOT_FOUND");
  }

  const recoverySession = await findRecoverySession(payment.id, store);

  return {
    ok: true,
    paymentId: payment.id,
    orderId: payment.order.id,
    merchantId: payment.order.merchantId,
    policy: projectPolicy(payment.order.merchant?.policy ?? null),
    attemptCount: recoverySession?.attemptCount ?? 0,
    recoverySessionId: recoverySession?.id ?? null,
  };
}
