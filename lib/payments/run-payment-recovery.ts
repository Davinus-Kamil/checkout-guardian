import {
  deriveRecoveryEligibility,
  type RecoveryEligibilityReason,
  type RecoveryEligibilityResult,
} from "./derive-recovery-eligibility.ts";
import {
  evaluateRecoveryPolicy,
  type PolicyGateReason,
  type PolicyGateResult,
  type RecoveryPolicyContext,
} from "./evaluate-recovery-policy.ts";
import {
  loadRecoveryGateContext,
  type RecoveryGateContextFailureReason,
  type RecoveryGateContextResult,
} from "./load-recovery-gate-context.ts";
import {
  persistRecoveryGateDecision,
  type PersistRecoveryGateDecisionFailureReason,
  type PersistRecoveryGateDecisionInput,
  type PersistRecoveryGateDecisionResult,
} from "./persist-recovery-gate-decision.ts";
import {
  proposeRecoveryAction,
  type RecoveryProposalReason,
  type RecoveryProposalResult,
} from "./propose-recovery-action.ts";
import {
  startAuthorizedRecovery,
  type StartAuthorizedRecoveryInput,
  type StartRecoveryAttemptFailureReason,
  type StartRecoveryAttemptResult,
} from "./start-authorized-recovery.ts";
import {
  verifyRazorpayPaymentState,
  type PaymentVerificationFailureReason,
  type PaymentVerificationResult,
} from "./verify-razorpay-payment-state.ts";

export type PaymentRecoveryFailureReason =
  | PaymentVerificationFailureReason
  | RecoveryEligibilityReason
  | RecoveryProposalReason
  | RecoveryGateContextFailureReason
  | PolicyGateReason
  | PersistRecoveryGateDecisionFailureReason
  | StartRecoveryAttemptFailureReason
  | "INTERNAL_ERROR";

export type RunPaymentRecoveryResult =
  | {
      started: true;
      recoverySessionId: string;
      decisionId: string;
      action: "REOPEN_CHECKOUT";
      attemptCount: number;
      sessionStatus: "IN_PROGRESS";
    }
  | {
      started: false;
      reason: PaymentRecoveryFailureReason;
      recoverySessionId?: string;
      decisionId?: string;
      policyResult?: "BLOCK";
    };

export type RunPaymentRecoveryDeps = {
  verifyPaymentState: (
    razorpayPaymentId: string,
  ) => Promise<PaymentVerificationResult>;
  deriveEligibility: (
    verification: PaymentVerificationResult,
  ) => RecoveryEligibilityResult;
  proposeAction: (
    eligibility: RecoveryEligibilityResult,
  ) => RecoveryProposalResult;
  loadContext: (razorpayPaymentId: string) => Promise<RecoveryGateContextResult>;
  evaluatePolicy: (input: {
    proposal: RecoveryProposalResult;
    policy: RecoveryPolicyContext | null;
    attemptCount: number;
  }) => PolicyGateResult;
  persistDecision: (
    input: PersistRecoveryGateDecisionInput,
  ) => Promise<PersistRecoveryGateDecisionResult>;
  startAuthorized: (
    input: StartAuthorizedRecoveryInput,
  ) => Promise<StartRecoveryAttemptResult>;
};

const defaultDeps: RunPaymentRecoveryDeps = {
  verifyPaymentState: verifyRazorpayPaymentState,
  deriveEligibility: deriveRecoveryEligibility,
  proposeAction: proposeRecoveryAction,
  loadContext: loadRecoveryGateContext,
  evaluatePolicy: evaluateRecoveryPolicy,
  persistDecision: persistRecoveryGateDecision,
  startAuthorized: startAuthorizedRecovery,
};

function stopped(
  reason: PaymentRecoveryFailureReason,
  extras?: {
    recoverySessionId?: string;
    decisionId?: string;
    policyResult?: "BLOCK";
  },
): RunPaymentRecoveryResult {
  return {
    started: false,
    reason,
    ...extras,
  };
}

export function parseRecoverPaymentBody(
  payload: unknown,
): { ok: true; razorpayPaymentId: string } | { ok: false } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false };
  }

  const razorpayPaymentId = (payload as Record<string, unknown>)
    .razorpay_payment_id;

  if (typeof razorpayPaymentId !== "string" || !razorpayPaymentId.trim()) {
    return { ok: false };
  }

  return { ok: true, razorpayPaymentId };
}

export function recoveryHttpStatus(result: RunPaymentRecoveryResult): number {
  if (result.started) {
    return 200;
  }

  if (
    result.reason === "INVALID_INPUT" ||
    result.reason === "INVALID_PAYMENT_ID"
  ) {
    return 400;
  }

  if (result.reason === "INTERNAL_ERROR") {
    return 500;
  }

  return 200;
}

export async function runPaymentRecovery(
  razorpayPaymentId: string,
  deps: RunPaymentRecoveryDeps = defaultDeps,
): Promise<RunPaymentRecoveryResult> {
  if (!razorpayPaymentId.trim()) {
    return stopped("INVALID_INPUT");
  }

  const verification = await deps.verifyPaymentState(razorpayPaymentId);

  if (!verification.verified) {
    return stopped(verification.reason);
  }

  const eligibility = deps.deriveEligibility(verification);

  if (!eligibility.eligible) {
    return stopped(eligibility.reason);
  }

  const proposal = deps.proposeAction(eligibility);

  if (!proposal.proposed) {
    return stopped(proposal.reason);
  }

  const context = await deps.loadContext(razorpayPaymentId);

  if (!context.ok) {
    return stopped(context.reason);
  }

  const gate = deps.evaluatePolicy({
    proposal,
    policy: context.policy,
    attemptCount: context.attemptCount,
  });

  const persisted = await deps.persistDecision({
    paymentId: context.paymentId,
    orderId: context.orderId,
    recoverySessionId: context.recoverySessionId,
    proposal,
    gate,
  });

  if (!persisted.persisted) {
    return stopped(persisted.reason);
  }

  if (persisted.policyResult === "BLOCK") {
    if (!persisted.policyReason) {
      return stopped("INCONSISTENT_GATE", {
        recoverySessionId: persisted.recoverySessionId,
        decisionId: persisted.decisionId,
      });
    }

    return stopped(persisted.policyReason as PolicyGateReason, {
      recoverySessionId: persisted.recoverySessionId,
      decisionId: persisted.decisionId,
      policyResult: "BLOCK",
    });
  }

  const started = await deps.startAuthorized({
    recoverySessionId: persisted.recoverySessionId,
    decisionId: persisted.decisionId,
  });

  if (!started.started) {
    return stopped(started.reason, {
      recoverySessionId: persisted.recoverySessionId,
      decisionId: persisted.decisionId,
    });
  }

  return {
    started: true,
    recoverySessionId: started.recoverySessionId,
    decisionId: started.decisionId,
    action: "REOPEN_CHECKOUT",
    attemptCount: started.attemptCount,
    sessionStatus: "IN_PROGRESS",
  };
}
