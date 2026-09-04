import { DEMO_MERCHANT_ID } from "../merchants/demo-merchant.ts";

export type LoadedMerchantPolicy = {
  merchantId: string;
  requireConfirmedFailure: boolean;
  maxRecoveryAttempts: number;
  allowAlternativeMethod: boolean;
  unknownStateAction: string;
  riskFailureAction: string;
  updatedAt: Date;
};

export type MerchantPolicyLoadResult =
  | { ok: true; policy: LoadedMerchantPolicy }
  | { ok: false; reason: "POLICY_NOT_FOUND" };

const policySelect = {
  merchantId: true,
  requireConfirmedFailure: true,
  maxRecoveryAttempts: true,
  allowAlternativeMethod: true,
  unknownStateAction: true,
  riskFailureAction: true,
  updatedAt: true,
} as const;

export type MerchantPolicyLoadStore = {
  merchantPolicy: {
    findUnique: (args: {
      where: { merchantId: string };
      select: typeof policySelect;
    }) => Promise<LoadedMerchantPolicy | null>;
  };
};

export async function loadMerchantPolicy(
  store?: MerchantPolicyLoadStore,
): Promise<MerchantPolicyLoadResult> {
  try {
    const policy = store
      ? await store.merchantPolicy.findUnique({
          where: { merchantId: DEMO_MERCHANT_ID },
          select: policySelect,
        })
      : await (async () => {
          const { prisma } = await import("../prisma.ts");
          return prisma.merchantPolicy.findUnique({
            where: { merchantId: DEMO_MERCHANT_ID },
            select: policySelect,
          });
        })();

    if (!policy) {
      return { ok: false, reason: "POLICY_NOT_FOUND" };
    }

    return { ok: true, policy };
  } catch {
    return { ok: false, reason: "POLICY_NOT_FOUND" };
  }
}
