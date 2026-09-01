import type { FailureCategory } from "./classify-payment-failure.ts";
import type { GuardianPaymentState } from "./derive-guardian-payment-state.ts";
import type {
  RecoveryEligibilityReason,
  RecoveryEligibilityResult,
} from "./derive-recovery-eligibility.ts";

export type RecoveryCandidateAction = "REOPEN_CHECKOUT";

export type RecoveryProposalReason =
  | RecoveryEligibilityReason
  | "INCONSISTENT_ELIGIBILITY";

export type RecoveryProposalResult =
  | {
      proposed: true;
      action: "REOPEN_CHECKOUT";
      guardianState: "FAILED";
      failureCategory: "GENERIC_PAYMENT_FAILED";
    }
  | {
      proposed: false;
      action: null;
      guardianState: GuardianPaymentState;
      failureCategory: FailureCategory | null;
      reason: RecoveryProposalReason;
    };

type EligibilityRuntime = {
  eligible: boolean;
  guardianState: GuardianPaymentState;
  failureCategory: FailureCategory | null;
  reason?: RecoveryEligibilityReason;
};

export function proposeRecoveryAction(
  eligibility: RecoveryEligibilityResult,
): RecoveryProposalResult {
  const record = eligibility as EligibilityRuntime;

  if (
    record.eligible === true &&
    record.guardianState === "FAILED" &&
    record.failureCategory === "GENERIC_PAYMENT_FAILED"
  ) {
    return {
      proposed: true,
      action: "REOPEN_CHECKOUT",
      guardianState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    };
  }

  if (!record.eligible) {
    return {
      proposed: false,
      action: null,
      guardianState: record.guardianState,
      failureCategory: record.failureCategory,
      reason: record.reason ?? "INCONSISTENT_ELIGIBILITY",
    };
  }

  return {
    proposed: false,
    action: null,
    guardianState: record.guardianState,
    failureCategory: record.failureCategory,
    reason: "INCONSISTENT_ELIGIBILITY",
  };
}
