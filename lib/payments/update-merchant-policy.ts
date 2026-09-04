import { DEMO_MERCHANT_ID } from "../merchants/demo-merchant.ts";
import type { MerchantPolicyUpdateInput } from "./parse-merchant-policy-update.ts";
import type { LoadedMerchantPolicy } from "./load-merchant-policy.ts";

export type UpdateMerchantPolicyResult =
  | { ok: true; policy: LoadedMerchantPolicy }
  | { ok: false; reason: "POLICY_NOT_FOUND" | "INVALID_INPUT" };

const policySelect = {
  merchantId: true,
  requireConfirmedFailure: true,
  maxRecoveryAttempts: true,
  allowAlternativeMethod: true,
  unknownStateAction: true,
  riskFailureAction: true,
  updatedAt: true,
} as const;

export type MerchantPolicyUpdateStore = {
  merchantPolicy: {
    findUnique: (args: {
      where: { merchantId: string };
      select: { merchantId: true };
    }) => Promise<{ merchantId: string } | null>;
    update: (args: {
      where: { merchantId: string };
      data: MerchantPolicyUpdateInput;
      select: typeof policySelect;
    }) => Promise<LoadedMerchantPolicy>;
  };
};

export async function updateMerchantPolicy(
  update: MerchantPolicyUpdateInput,
  store?: MerchantPolicyUpdateStore,
): Promise<UpdateMerchantPolicyResult> {
  if (
    typeof update.requireConfirmedFailure !== "boolean" ||
    typeof update.allowAlternativeMethod !== "boolean" ||
    !Number.isInteger(update.maxRecoveryAttempts)
  ) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  try {
    const db: MerchantPolicyUpdateStore = store
      ? store
      : ((await import("../prisma.ts")).prisma as unknown as MerchantPolicyUpdateStore);

    const existing = await db.merchantPolicy.findUnique({
      where: { merchantId: DEMO_MERCHANT_ID },
      select: { merchantId: true },
    });

    if (!existing) {
      return { ok: false, reason: "POLICY_NOT_FOUND" };
    }

    const policy = await db.merchantPolicy.update({
      where: { merchantId: DEMO_MERCHANT_ID },
      data: {
        requireConfirmedFailure: update.requireConfirmedFailure,
        maxRecoveryAttempts: update.maxRecoveryAttempts,
        allowAlternativeMethod: update.allowAlternativeMethod,
      },
      select: policySelect,
    });

    return { ok: true, policy };
  } catch {
    return { ok: false, reason: "POLICY_NOT_FOUND" };
  }
}
