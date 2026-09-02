export type RecoverPaymentClientOutcome =
  | "started"
  | "payment_not_found"
  | "denied"
  | "unsafe";

export const RECOVER_PAYMENT_NOT_FOUND_MAX_ATTEMPTS = 3;
export const RECOVER_PAYMENT_NOT_FOUND_RETRY_DELAY_MS = 500;

export function interpretRecoverPaymentHttpResponse(
  httpStatus: number,
  payload: unknown,
): RecoverPaymentClientOutcome {
  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
    return "unsafe";
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "unsafe";
  }

  const body = payload as Record<string, unknown>;

  if (body.started === true) {
    return "started";
  }

  if (body.started !== false) {
    return "unsafe";
  }

  if (body.reason === "PAYMENT_NOT_FOUND") {
    return "payment_not_found";
  }

  if (typeof body.reason === "string" && body.reason.trim()) {
    return "denied";
  }

  return "unsafe";
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
