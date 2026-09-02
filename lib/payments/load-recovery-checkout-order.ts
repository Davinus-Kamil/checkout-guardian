export type RecoveryCheckoutOrder = {
  razorpayOrderId: string;
  amount: number;
  currency: string;
};

type LoadedOrder = {
  razorpayOrderId: string;
  amount: number;
  currency: string;
};

export type RecoveryCheckoutOrderStore = {
  order: {
    findUnique: (args: {
      where: { id: string };
      select: {
        razorpayOrderId: true;
        amount: true;
        currency: true;
      };
    }) => Promise<LoadedOrder | null>;
  };
};

const orderSelect = {
  razorpayOrderId: true,
  amount: true,
  currency: true,
} as const;

function isUsableCheckoutOrder(order: LoadedOrder): boolean {
  return (
    typeof order.razorpayOrderId === "string" &&
    order.razorpayOrderId.trim().length > 0 &&
    Number.isInteger(order.amount) &&
    order.amount > 0 &&
    typeof order.currency === "string" &&
    order.currency.trim().length > 0
  );
}

export async function loadRecoveryCheckoutOrder(
  orderId: string,
  store?: RecoveryCheckoutOrderStore,
): Promise<RecoveryCheckoutOrder | null> {
  if (!orderId.trim()) {
    return null;
  }

  const order = store
    ? await store.order.findUnique({
        where: { id: orderId },
        select: orderSelect,
      })
    : await (async () => {
        const { prisma } = await import("../prisma.ts");
        return prisma.order.findUnique({
          where: { id: orderId },
          select: orderSelect,
        });
      })();

  if (!order || !isUsableCheckoutOrder(order)) {
    return null;
  }

  return {
    razorpayOrderId: order.razorpayOrderId,
    amount: order.amount,
    currency: order.currency,
  };
}
