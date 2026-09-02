export type RecoverPaymentClientOutcome =
  | "started"
  | "payment_not_found"
  | "denied"
  | "unsafe";

export type RecoveryCheckoutInstructions = {
  orderId: string;
  amount: number;
  currency: string;
};

export type RecoverPaymentClientResult =
  | {
      outcome: "started";
      checkout: RecoveryCheckoutInstructions;
    }
  | {
      outcome: "payment_not_found";
    }
  | {
      outcome: "denied";
    }
  | {
      outcome: "unsafe";
    };

export const RECOVER_PAYMENT_NOT_FOUND_MAX_ATTEMPTS = 3;
export const RECOVER_PAYMENT_NOT_FOUND_RETRY_DELAY_MS = 500;

function readCheckoutInstructions(
  value: unknown,
): RecoveryCheckoutInstructions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const checkout = value as Record<string, unknown>;
  const orderId = checkout.orderId;
  const amount = checkout.amount;
  const currency = checkout.currency;

  if (typeof orderId !== "string" || !orderId.trim()) {
    return null;
  }

  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return null;
  }

  if (typeof currency !== "string" || !currency.trim()) {
    return null;
  }

  return {
    orderId,
    amount,
    currency,
  };
}

export function interpretRecoverPaymentHttpResponse(
  httpStatus: number,
  payload: unknown,
): RecoverPaymentClientResult {
  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
    return { outcome: "unsafe" };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { outcome: "unsafe" };
  }

  const body = payload as Record<string, unknown>;

  if (body.started === true) {
    const checkout = readCheckoutInstructions(body.checkout);

    if (!checkout) {
      return { outcome: "unsafe" };
    }

    return { outcome: "started", checkout };
  }

  if (body.started !== false) {
    return { outcome: "unsafe" };
  }

  if (body.reason === "PAYMENT_NOT_FOUND") {
    return { outcome: "payment_not_found" };
  }

  if (typeof body.reason === "string" && body.reason.trim()) {
    return { outcome: "denied" };
  }

  return { outcome: "unsafe" };
}

export function shouldRetryRecoverPayment(
  outcome: RecoverPaymentClientOutcome,
  attemptNumber: number,
): boolean {
  return (
    outcome === "payment_not_found" &&
    attemptNumber < RECOVER_PAYMENT_NOT_FOUND_MAX_ATTEMPTS
  );
}
