export const MERCHANT_POLICY_MIN_RECOVERY_ATTEMPTS = 0;
export const MERCHANT_POLICY_MAX_RECOVERY_ATTEMPTS = 3;

export type MerchantPolicyUpdateInput = {
  requireConfirmedFailure: boolean;
  maxRecoveryAttempts: number;
  allowAlternativeMethod: boolean;
};

export type ParseMerchantPolicyUpdateResult =
  | { ok: true; update: MerchantPolicyUpdateInput }
  | { ok: false; reason: "INVALID_INPUT" };

const FORBIDDEN_FIELDS = [
  "unknownStateAction",
  "riskFailureAction",
  "merchantId",
  "policyResult",
  "executedAction",
  "outcome",
  "recoveredAmount",
  "execute",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedAttemptCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MERCHANT_POLICY_MIN_RECOVERY_ATTEMPTS &&
    value <= MERCHANT_POLICY_MAX_RECOVERY_ATTEMPTS
  );
}

export function parseMerchantPolicyUpdate(
  payload: unknown,
): ParseMerchantPolicyUpdateResult {
  if (!isRecord(payload)) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  for (const field of FORBIDDEN_FIELDS) {
    if (field in payload) {
      return { ok: false, reason: "INVALID_INPUT" };
    }
  }

  const requireConfirmedFailure = payload.requireConfirmedFailure;
  const maxRecoveryAttempts = payload.maxRecoveryAttempts;
  const allowAlternativeMethod = payload.allowAlternativeMethod;

  if (typeof requireConfirmedFailure !== "boolean") {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  if (typeof allowAlternativeMethod !== "boolean") {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  if (!isBoundedAttemptCount(maxRecoveryAttempts)) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  return {
    ok: true,
    update: {
      requireConfirmedFailure,
      maxRecoveryAttempts,
      allowAlternativeMethod,
    },
  };
}
