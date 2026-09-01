import {
  classifyPaymentFailure,
  type FailureCategory,
} from "./classify-payment-failure.ts";
import {
  deriveGuardianPaymentState,
  type GuardianPaymentState,
} from "./derive-guardian-payment-state.ts";
import {
  normalizePaymentFacts,
  type NormalizedPaymentFacts,
} from "./normalize-payment-facts.ts";
import { getRazorpayClient } from "../razorpay/client.ts";

export type PaymentVerificationFailureReason =
  | "INVALID_PAYMENT_ID"
  | "FETCH_FAILED"
  | "MALFORMED_PAYMENT";

export type PaymentVerificationResult =
  | {
      verified: true;
      razorpayPaymentId: string;
      gatewayStatus: string;
      facts: NormalizedPaymentFacts;
      guardianState: GuardianPaymentState;
      failureCategory: FailureCategory | null;
    }
  | {
      verified: false;
      razorpayPaymentId: string;
      guardianState: "UNRESOLVED";
      failureCategory: null;
      reason: PaymentVerificationFailureReason;
    };

export type FetchRazorpayPayment = (paymentId: string) => Promise<unknown>;

function unresolved(
  razorpayPaymentId: string,
  reason: PaymentVerificationFailureReason,
): PaymentVerificationResult {
  return {
    verified: false,
    razorpayPaymentId,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readNonEmptyString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const field = record[key];
  return typeof field === "string" && field.trim() ? field : null;
}

function readOptionalFactString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const field = record[key];

  if (typeof field !== "string") {
    return null;
  }

  return field;
}

async function fetchRazorpayPayment(paymentId: string): Promise<unknown> {
  const razorpay = getRazorpayClient();
  return razorpay.payments.fetch(paymentId);
}

export async function verifyRazorpayPaymentState(
  razorpayPaymentId: string,
  fetchPayment: FetchRazorpayPayment = fetchRazorpayPayment,
): Promise<PaymentVerificationResult> {
  if (!razorpayPaymentId.trim()) {
    return unresolved(razorpayPaymentId, "INVALID_PAYMENT_ID");
  }

  let payment: unknown;

  try {
    payment = await fetchPayment(razorpayPaymentId);
  } catch {
    return unresolved(razorpayPaymentId, "FETCH_FAILED");
  }

  const record = asRecord(payment);
  const returnedId = record ? readNonEmptyString(record, "id") : null;
  const gatewayStatus = record ? readNonEmptyString(record, "status") : null;

  if (!record || !returnedId || returnedId !== razorpayPaymentId || !gatewayStatus) {
    return unresolved(razorpayPaymentId, "MALFORMED_PAYMENT");
  }

  const facts = normalizePaymentFacts({
    gatewayStatus,
    method: readOptionalFactString(record, "method"),
    errorCode: readOptionalFactString(record, "error_code"),
    errorReason: readOptionalFactString(record, "error_reason"),
  });

  return {
    verified: true,
    razorpayPaymentId,
    gatewayStatus,
    facts,
    guardianState: deriveGuardianPaymentState(facts),
    failureCategory: classifyPaymentFailure(facts),
  };
}
