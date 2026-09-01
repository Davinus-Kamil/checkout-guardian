import type { NormalizedPaymentFacts } from "./normalize-payment-facts.ts";

export type GuardianPaymentState = "SUCCESS" | "FAILED" | "UNRESOLVED";

export function deriveGuardianPaymentState(
  facts: Pick<NormalizedPaymentFacts, "normalizedStatus">,
): GuardianPaymentState {
  switch (facts.normalizedStatus) {
    case "captured":
      return "SUCCESS";
    case "failed":
      return "FAILED";
    case "unknown":
      return "UNRESOLVED";
  }
}
