export const NORMAL_PAYMENT_VERIFIED_MESSAGE =
  "Payment verified successfully";

export type RecoveryFinalizationView = {
  finalized: true;
  recoveredAmount: number;
  currency: string;
};

function readRecoveryFinalization(
  payload: unknown,
): RecoveryFinalizationView | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const body = payload as Record<string, unknown>;
  const recovery = body.recovery;

  if (!recovery || typeof recovery !== "object" || Array.isArray(recovery)) {
    return null;
  }

  const fields = recovery as Record<string, unknown>;
  const recoveredAmount = fields.recoveredAmount;
  const currency = fields.currency;

  if (fields.finalized !== true) {
    return null;
  }

  if (
    typeof recoveredAmount !== "number" ||
    !Number.isInteger(recoveredAmount) ||
    recoveredAmount <= 0
  ) {
    return null;
  }

  if (typeof currency !== "string" || !currency.trim()) {
    return null;
  }

  return {
    finalized: true,
    recoveredAmount,
    currency,
  };
}

function formatMajorUnits(amountPaise: number): string {
  return Math.trunc(amountPaise / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatRecoveredSuccessMessage(
  recoveredAmount: number,
  currency: string,
): string {
  const formatted = formatMajorUnits(recoveredAmount);

  if (currency === "INR") {
    return `Payment recovered successfully. ₹${formatted} recovered.`;
  }

  return `Payment recovered successfully. ${formatted} ${currency} recovered.`;
}

export function messageForVerifiedCheckoutPayment(payload: unknown): string {
  const recovery = readRecoveryFinalization(payload);

  if (!recovery) {
    return NORMAL_PAYMENT_VERIFIED_MESSAGE;
  }

  return formatRecoveredSuccessMessage(
    recovery.recoveredAmount,
    recovery.currency,
  );
}
