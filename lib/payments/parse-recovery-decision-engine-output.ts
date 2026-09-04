export const RECOVERY_DECISION_ENGINE_REASON_MAX_LENGTH = 280;

export type RecoveryDecisionEngineRecommendedAction =
  | "REOPEN_CHECKOUT"
  | "NO_RECOVERY";

export type ParseRecoveryDecisionEngineOutputResult =
  | {
      ok: true;
      recommendedAction: RecoveryDecisionEngineRecommendedAction;
      reason: string;
    }
  | { ok: false };

const FORBIDDEN_AUTHORITY_FIELDS = [
  "guardianState",
  "failureCategory",
  "verified",
  "policyResult",
  "executedAction",
  "outcome",
  "recoveredAmount",
  "execute",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeReason(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const reason = value.trim();

  if (!reason || reason.length > RECOVERY_DECISION_ENGINE_REASON_MAX_LENGTH) {
    return null;
  }

  return reason;
}

export function parseRecoveryDecisionEngineOutput(
  value: unknown,
): ParseRecoveryDecisionEngineOutputResult {
  if (!isRecord(value)) {
    return { ok: false };
  }

  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    if (field in value) {
      return { ok: false };
    }
  }

  const recommendedAction = value.recommendedAction;
  const reason = sanitizeReason(value.reason);

  if (
    recommendedAction !== "REOPEN_CHECKOUT" &&
    recommendedAction !== "NO_RECOVERY"
  ) {
    return { ok: false };
  }

  if (!reason) {
    return { ok: false };
  }

  return {
    ok: true,
    recommendedAction,
    reason,
  };
}
