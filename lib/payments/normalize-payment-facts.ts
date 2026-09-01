export type PaymentFactsInput = {
  gatewayStatus: string | null;
  method: string | null;
  errorCode: string | null;
  errorReason: string | null;
};

export type NormalizedStatus = "captured" | "failed" | "unknown";

export type NormalizedPaymentFacts = {
  normalizedStatus: NormalizedStatus;
  paymentMethod: string | null;
  errorCode: string | null;
  errorReason: string | null;
  isCaptured: boolean;
  isFailed: boolean;
};

function preserveOrNull(value: string | null): string | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  return value;
}

export function normalizePaymentFacts(
  input: PaymentFactsInput,
): NormalizedPaymentFacts {
  const normalizedStatus: NormalizedStatus =
    input.gatewayStatus === "captured"
      ? "captured"
      : input.gatewayStatus === "failed"
        ? "failed"
        : "unknown";

  return {
    normalizedStatus,
    paymentMethod: preserveOrNull(input.method),
    errorCode: preserveOrNull(input.errorCode),
    errorReason: preserveOrNull(input.errorReason),
    isCaptured: normalizedStatus === "captured",
    isFailed: normalizedStatus === "failed",
  };
}
