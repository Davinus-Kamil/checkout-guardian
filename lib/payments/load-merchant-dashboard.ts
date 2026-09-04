import {
  emptyMerchantDashboard,
  MERCHANT_DASHBOARD_RECENT_LIMIT,
  presentMerchantDashboard,
  type MerchantDashboardDecisionRecord,
  type PresentedMerchantDashboard,
} from "./present-merchant-dashboard.ts";

const decisionSelect = {
  id: true,
  paymentState: true,
  failureCategory: true,
  proposedAction: true,
  proposalReason: true,
  policyResult: true,
  policyReason: true,
  executedAction: true,
  outcome: true,
  recoveredAmount: true,
  createdAt: true,
} as const;

export type MerchantDashboardStore = {
  decision: {
    aggregate: (args: {
      where: { outcome: "RECOVERED" };
      _sum: { recoveredAmount: true };
      _count: { _all: true };
    }) => Promise<{
      _sum: { recoveredAmount: number | null };
      _count: { _all: number };
    }>;
    count: (args: {
      where: { policyResult: "BLOCK" };
    }) => Promise<number>;
    findMany: (args: {
      orderBy: { createdAt: "desc" };
      take: number;
      select: typeof decisionSelect;
    }) => Promise<MerchantDashboardDecisionRecord[]>;
  };
};

async function loadFromStore(
  store: MerchantDashboardStore,
): Promise<PresentedMerchantDashboard> {
  const [recovered, blockedCount, decisions] = await Promise.all([
    store.decision.aggregate({
      where: { outcome: "RECOVERED" },
      _sum: { recoveredAmount: true },
      _count: { _all: true },
    }),
    store.decision.count({
      where: { policyResult: "BLOCK" },
    }),
    store.decision.findMany({
      orderBy: { createdAt: "desc" },
      take: MERCHANT_DASHBOARD_RECENT_LIMIT,
      select: decisionSelect,
    }),
  ]);

  return presentMerchantDashboard({
    recoveredCount: recovered._count._all,
    recoveredAmountPaise: recovered._sum.recoveredAmount,
    blockedCount,
    decisions,
  });
}

export async function loadMerchantDashboard(
  store?: MerchantDashboardStore,
): Promise<PresentedMerchantDashboard> {
  try {
    if (store) {
      return loadFromStore(store);
    }

    const { prisma } = await import("../prisma.ts");
    return loadFromStore(prisma as unknown as MerchantDashboardStore);
  } catch {
    return emptyMerchantDashboard();
  }
}
