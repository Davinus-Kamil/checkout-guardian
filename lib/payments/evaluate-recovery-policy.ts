import type { FailureCategory } from "./classify-payment-failure.ts";
import type { GuardianPaymentState } from "./derive-guardian-payment-state.ts";
import type {
  RecoveryCandidateAction,
  RecoveryProposalResult,
} from "./propose-recovery-action.ts";

export type RecoveryPolicyContext = {
  requireConfirmedFailure: boolean;
  maxRecoveryAttempts: number;
};

export type PolicyGateReason =
  | "NO_PROPOSAL"
  | "MISSING_POLICY"
  | "INVALID_POLICY"
  | "INCONSISTENT_PROPOSAL"
  | "MAX_ATTEMPTS_REACHED";

export type PolicyGateResult =
  | {
      allowed: true;
      action: "REOPEN_CHECKOUT";
      guardianState: "FAILED";
      failureCategory: "GENERIC_PAYMENT_FAILED";
    }
  | {
      allowed: false;
      action: RecoveryCandidateAction | null;
      guardianState: GuardianPaymentState;
      failureCategory: FailureCategory | null;
      reason: PolicyGateReason;
    };

type ProposalRuntime = {
  proposed: boolean;
  action: RecoveryCandidateAction | null;
  guardianState: GuardianPaymentState;
  failureCategory: FailureCategory | null;
};

type PolicyRuntime = {
  requireConfirmedFailure: unknown;
  maxRecoveryAttempts: unknown;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function blocked(
  proposal: ProposalRuntime,
  reason: PolicyGateReason,
): PolicyGateResult {
  return {
    allowed: false,
    action: proposal.action,
    guardianState: proposal.guardianState,
    failureCategory: proposal.failureCategory,
    reason,
  };
}

export function evaluateRecoveryPolicy(input: {
  proposal: RecoveryProposalResult;
  policy: RecoveryPolicyContext | null;
  attemptCount: number;
}): PolicyGateResult {
  const proposal = input.proposal as ProposalRuntime;

  if (proposal.proposed === false) {
    return blocked(
      { ...proposal, action: null },
      "NO_PROPOSAL",
    );
  }

  if (
    proposal.action !== "REOPEN_CHECKOUT" ||
    proposal.guardianState !== "FAILED" ||
    proposal.failureCategory !== "GENERIC_PAYMENT_FAILED"
  ) {
    return blocked(proposal, "INCONSISTENT_PROPOSAL");
  }

  if (input.policy === null) {
    return blocked(proposal, "MISSING_POLICY");
  }

  const policy = input.policy as PolicyRuntime;

  if (
    typeof policy.requireConfirmedFailure !== "boolean" ||
    !isNonNegativeInteger(policy.maxRecoveryAttempts) ||
    !isNonNegativeInteger(input.attemptCount)
  ) {
    return blocked(proposal, "INVALID_POLICY");
  }

  if (input.attemptCount >= policy.maxRecoveryAttempts) {
    return blocked(proposal, "MAX_ATTEMPTS_REACHED");
  }

  return {
    allowed: true,
    action: "REOPEN_CHECKOUT",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
  };
}
