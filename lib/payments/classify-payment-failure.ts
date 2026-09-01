import type { NormalizedPaymentFacts } from "./normalize-payment-facts.ts";

export type FailureCategory = "GENERIC_PAYMENT_FAILED" | "UNKNOWN";

export type ClassifyPaymentFailureResult = FailureCategory | null;

export function classifyPaymentFailure(
  facts: Pick<NormalizedPaymentFacts, "normalizedStatus" | "errorCode" | "errorReason">,
): ClassifyPaymentFailureResult {
  switch (facts.normalizedStatus) {
    case "captured":
    case "unknown":
      return null;
    case "failed":
      if (
        facts.errorCode === "BAD_REQUEST_ERROR" &&
        facts.errorReason === "payment_failed"
      ) {
        return "GENERIC_PAYMENT_FAILED";
      }

      return "UNKNOWN";
  }
}
