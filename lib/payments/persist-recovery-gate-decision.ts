import type { PolicyGateResult } from "./evaluate-recovery-policy.ts";
import type { RecoveryProposalResult } from "./propose-recovery-action.ts";

export const RECOVERY_PROPOSAL_REASON_MAX_LENGTH = 280;

export type PersistRecoveryGateDecisionInput = {
  paymentId: string;
  orderId: string;
  recoverySessionId: string | null;
  proposal: RecoveryProposalResult;
  gate: PolicyGateResult;
  proposalReason?: string | null;
};

export type PersistRecoveryGateDecisionFailureReason =
  | "NO_PROPOSAL"
  | "INVALID_INPUT"
  | "INCONSISTENT_GATE"
  | "SESSION_MISMATCH";

export type PersistRecoveryGateDecisionResult =
  | {
      persisted: true;
      recoverySessionId: string;
      decisionId: string;
      policyResult: "ALLOW" | "BLOCK";
      policyReason: string | null;
    }
  | {
      persisted: false;
      reason: PersistRecoveryGateDecisionFailureReason;
    };

type SessionRow = {
  id: string;
  orderId: string;
  originalPaymentId: string;
  status: string;
  attemptCount: number;
};

type DecisionRow = {
  id: string;
};

const sessionSelect = {
  id: true,
  orderId: true,
  originalPaymentId: true,
  status: true,
  attemptCount: true,
} as const;

const persistableBlockReasons = new Set([
  "MISSING_POLICY",
  "INVALID_POLICY",
  "INCONSISTENT_PROPOSAL",
  "MAX_ATTEMPTS_REACHED",
]);

export type PersistRecoveryGateTx = {
  recoverySession: {
    findUnique: (args: {
      where: { id: string } | { originalPaymentId: string };
      select: typeof sessionSelect;
    }) => Promise<SessionRow | null>;
    upsert: (args: {
      where: { originalPaymentId: string };
      create: {
        orderId: string;
        originalPaymentId: string;
        status: "OPEN";
        attemptCount: 0;
      };
      update: Record<string, never>;
      select: typeof sessionSelect;
    }) => Promise<SessionRow>;
  };
  decision: {
    create: (args: {
      data: {
        recoverySessionId: string;
        paymentId: string;
        failureCategory: "GENERIC_PAYMENT_FAILED" | null;
        paymentState: "FAILED" | "UNRESOLVED";
        proposedAction: "REOPEN_CHECKOUT";
        proposalReason: string | null;
        policyResult: "ALLOW" | "BLOCK";
        policyReason: string | null;
        executedAction: null;
        outcome: null;
        recoveredAmount: null;
      };
      select: { id: true };
    }) => Promise<DecisionRow>;
  };
};

export type PersistRecoveryGateDecisionStore = {
  $transaction: <T>(
    fn: (tx: PersistRecoveryGateTx) => Promise<T>,
  ) => Promise<T>;
};

function failed(
  reason: PersistRecoveryGateDecisionFailureReason,
): PersistRecoveryGateDecisionResult {
  return { persisted: false, reason };
}

function validateInput(
  input: PersistRecoveryGateDecisionInput,
): PersistRecoveryGateDecisionFailureReason | null {
  if (!input.paymentId.trim() || !input.orderId.trim()) {
    return "INVALID_INPUT";
  }

  if (input.proposal.proposed !== true) {
    return "NO_PROPOSAL";
  }

  if (isUnresolvedConfirmedFailureBlock(input)) {
    return null;
  }

  if (
    input.proposal.action !== "REOPEN_CHECKOUT" ||
    input.proposal.guardianState !== "FAILED" ||
    input.proposal.failureCategory !== "GENERIC_PAYMENT_FAILED"
  ) {
    return "INVALID_INPUT";
  }

  if (
    input.gate.action !== "REOPEN_CHECKOUT" ||
    input.gate.guardianState !== "FAILED" ||
    input.gate.failureCategory !== "GENERIC_PAYMENT_FAILED"
  ) {
    return "INCONSISTENT_GATE";
  }

  if (input.gate.allowed === true) {
    return null;
  }

  if (
    input.gate.allowed === false &&
    persistableBlockReasons.has(input.gate.reason)
  ) {
    return null;
  }

  return "INCONSISTENT_GATE";
}

function isUnresolvedConfirmedFailureBlock(
  input: PersistRecoveryGateDecisionInput,
): boolean {
  return (
    input.proposal.proposed === true &&
    input.proposal.action === "REOPEN_CHECKOUT" &&
    input.proposal.guardianState === "UNRESOLVED" &&
    input.proposal.failureCategory === null &&
    input.gate.allowed === false &&
    input.gate.action === "REOPEN_CHECKOUT" &&
    input.gate.guardianState === "UNRESOLVED" &&
    input.gate.failureCategory === null &&
    input.gate.reason === "CONFIRMED_FAILURE_REQUIRED"
  );
}

function sanitizedProposalReason(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const reason = value.trim();

  if (!reason || reason.length > RECOVERY_PROPOSAL_REASON_MAX_LENGTH) {
    return null;
  }

  return reason;
}

function decisionFields(
  input: PersistRecoveryGateDecisionInput,
  recoverySessionId: string,
) {
  const unresolvedBlock = isUnresolvedConfirmedFailureBlock(input);
  const shared = {
    recoverySessionId,
    paymentId: input.paymentId,
    failureCategory: unresolvedBlock ? null : ("GENERIC_PAYMENT_FAILED" as const),
    paymentState: unresolvedBlock ? ("UNRESOLVED" as const) : ("FAILED" as const),
    proposedAction: "REOPEN_CHECKOUT" as const,
    proposalReason: unresolvedBlock
      ? null
      : sanitizedProposalReason(input.proposalReason),
    executedAction: null,
    outcome: null,
    recoveredAmount: null,
  };

  if (input.gate.allowed) {
    return {
      ...shared,
      policyResult: "ALLOW" as const,
      policyReason: null,
    };
  }

  return {
    ...shared,
    policyResult: "BLOCK" as const,
    policyReason: input.gate.reason,
  };
}

function sessionMatches(
  session: SessionRow,
  input: PersistRecoveryGateDecisionInput,
): boolean {
  return (
    session.originalPaymentId === input.paymentId &&
    session.orderId === input.orderId
  );
}

async function persistInTransaction(
  tx: PersistRecoveryGateTx,
  input: PersistRecoveryGateDecisionInput,
): Promise<PersistRecoveryGateDecisionResult> {
  let session: SessionRow | null;

  if (input.recoverySessionId) {
    session = await tx.recoverySession.findUnique({
      where: { id: input.recoverySessionId },
      select: sessionSelect,
    });

    if (!session || !sessionMatches(session, input)) {
      return failed("SESSION_MISMATCH");
    }
  } else {
    session = await tx.recoverySession.upsert({
      where: { originalPaymentId: input.paymentId },
      create: {
        orderId: input.orderId,
        originalPaymentId: input.paymentId,
        status: "OPEN",
        attemptCount: 0,
      },
      update: {},
      select: sessionSelect,
    });

    if (!sessionMatches(session, input)) {
      return failed("SESSION_MISMATCH");
    }
  }

  const decision = await tx.decision.create({
    data: decisionFields(input, session.id),
    select: { id: true },
  });

  if (input.gate.allowed) {
    return {
      persisted: true,
      recoverySessionId: session.id,
      decisionId: decision.id,
      policyResult: "ALLOW",
      policyReason: null,
    };
  }

  return {
    persisted: true,
    recoverySessionId: session.id,
    decisionId: decision.id,
    policyResult: "BLOCK",
    policyReason: input.gate.reason,
  };
}

export async function persistRecoveryGateDecision(
  input: PersistRecoveryGateDecisionInput,
  store?: PersistRecoveryGateDecisionStore,
): Promise<PersistRecoveryGateDecisionResult> {
  const invalid = validateInput(input);

  if (invalid) {
    return failed(invalid);
  }

  if (store) {
    return store.$transaction((tx) => persistInTransaction(tx, input));
  }

  const { prisma } = await import("../prisma.ts");
  return prisma.$transaction((tx) =>
    persistInTransaction(tx as unknown as PersistRecoveryGateTx, input),
  );
}
