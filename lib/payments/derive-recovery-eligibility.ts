import type { FailureCategory } from "./classify-payment-failure.ts";
import type { GuardianPaymentState } from "./derive-guardian-payment-state.ts";
import type { PaymentVerificationResult } from "./verify-razorpay-payment-state.ts";

export type RecoveryEligibilityReason =
  | "NOT_VERIFIED"
  | "ALREADY_SUCCEEDED"
  | "UNRESOLVED_STATE"
  | "UNKNOWN_FAILURE"
  | "INCONSISTENT_VERIFIED_STATE";

export type RecoveryEligibilityResult =
  | {
      eligible: true;
      guardianState: "FAILED";
      failureCategory: "GENERIC_PAYMENT_FAILED";
    }
  | {
      eligible: false;
      guardianState: GuardianPaymentState;
      failureCategory: FailureCategory | null;
      reason: RecoveryEligibilityReason;
    };

export function deriveRecoveryEligibility(
  verification: PaymentVerificationResult,
): RecoveryEligibilityResult {
  if (!verification.verified) {
    return {
      eligible: false,
      guardianState: verification.guardianState,
      failureCategory: verification.failureCategory,
      reason: "NOT_VERIFIED",
    };
  }

  switch (verification.guardianState) {
    case "SUCCESS":
      return {
        eligible: false,
        guardianState: "SUCCESS",
        failureCategory: verification.failureCategory,
        reason: "ALREADY_SUCCEEDED",
      };
    case "UNRESOLVED":
      return {
        eligible: false,
        guardianState: "UNRESOLVED",
        failureCategory: verification.failureCategory,
        reason: "UNRESOLVED_STATE",
      };
    case "FAILED":
      if (verification.failureCategory === "GENERIC_PAYMENT_FAILED") {
        return {
          eligible: true,
          guardianState: "FAILED",
          failureCategory: "GENERIC_PAYMENT_FAILED",
        };
      }

      if (verification.failureCategory === "UNKNOWN") {
        return {
          eligible: false,
          guardianState: "FAILED",
          failureCategory: "UNKNOWN",
          reason: "UNKNOWN_FAILURE",
        };
      }

      return {
        eligible: false,
        guardianState: "FAILED",
        failureCategory: verification.failureCategory,
        reason: "INCONSISTENT_VERIFIED_STATE",
      };
  }
}
