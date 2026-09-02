import {
  verifyRazorpayPaymentState,
  type PaymentVerificationResult,
} from "./verify-razorpay-payment-state.ts";

export type ConfirmCheckoutPaymentResult =
  | {
      verified: true;
    }
  | {
      verified: false;
      httpStatus: 400 | 500;
      error?: string;
    };

type OrderRow = {
  id: string;
};

export type ConfirmCheckoutPaymentStore = {
  order: {
    findUnique: (args: {
      where: { razorpayOrderId: string };
    }) => Promise<OrderRow | null>;
  };
  payment: {
    upsert: (args: {
      where: { razorpayPaymentId: string };
      update: { guardianState: "SUCCESS" };
      create: {
        orderId: string;
        razorpayPaymentId: string;
        method: string | null;
        gatewayStatus: string;
        guardianState: "SUCCESS";
        failureCategory: null;
        errorCode: null;
        errorReason: null;
      };
    }) => Promise<unknown>;
  };
};

export type ConfirmCheckoutPaymentDeps = {
  verifySignature: (input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }) => boolean;
  verifyPaymentState: (
    razorpayPaymentId: string,
  ) => Promise<PaymentVerificationResult>;
  store: ConfirmCheckoutPaymentStore;
};

function readStringField(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function rejected(
  httpStatus: 400 | 500,
  error?: string,
): ConfirmCheckoutPaymentResult {
  return error
    ? { verified: false, httpStatus, error }
    : { verified: false, httpStatus };
}

function isAuthoritativeSuccess(
  verification: PaymentVerificationResult,
): verification is Extract<PaymentVerificationResult, { verified: true }> {
  return (
    verification.verified === true &&
    verification.guardianState === "SUCCESS" &&
    verification.failureCategory === null
  );
}

async function defaultStore(): Promise<ConfirmCheckoutPaymentStore> {
  const { prisma } = await import("../prisma.ts");
  return prisma;
}

export async function confirmCheckoutPayment(
  payload: unknown,
  deps?: Partial<ConfirmCheckoutPaymentDeps>,
): Promise<ConfirmCheckoutPaymentResult> {
  const paymentId = readStringField(payload, "razorpay_payment_id");
  const orderId = readStringField(payload, "razorpay_order_id");
  const signature = readStringField(payload, "razorpay_signature");

  if (!paymentId || !orderId || !signature) {
    return rejected(
      400,
      "Missing razorpay_payment_id, razorpay_order_id, or razorpay_signature.",
    );
  }

  const verifySignature =
    deps?.verifySignature ??
    (await import("../razorpay/verify-signature.ts"))
      .verifyRazorpayPaymentSignature;

  if (!verifySignature({ orderId, paymentId, signature })) {
    return rejected(400);
  }

  const store = deps?.store ?? (await defaultStore());
  const order = await store.order.findUnique({
    where: { razorpayOrderId: orderId },
  });

  if (!order) {
    return rejected(500, "Failed to verify payment");
  }

  const verifyPaymentState =
    deps?.verifyPaymentState ?? verifyRazorpayPaymentState;
  const verification = await verifyPaymentState(paymentId);

  if (!isAuthoritativeSuccess(verification)) {
    return rejected(400);
  }

  await store.payment.upsert({
    where: { razorpayPaymentId: paymentId },
    update: {
      guardianState: "SUCCESS",
    },
    create: {
      orderId: order.id,
      razorpayPaymentId: paymentId,
      method: verification.facts.paymentMethod,
      gatewayStatus: verification.gatewayStatus,
      guardianState: "SUCCESS",
      failureCategory: null,
      errorCode: null,
      errorReason: null,
    },
  });

  return { verified: true };
}
