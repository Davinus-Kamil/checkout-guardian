import assert from "node:assert/strict";
import { test } from "node:test";
import { loadRecoveryCheckoutOrder } from "./load-recovery-checkout-order.ts";

test("blank internal order id does not look up", async () => {
  let lookups = 0;
  const result = await loadRecoveryCheckoutOrder("  ", {
    order: {
      findUnique: async () => {
        lookups += 1;
        return {
          razorpayOrderId: "order_1",
          amount: 349900,
          currency: "INR",
        };
      },
    },
  });

  assert.equal(result, null);
  assert.equal(lookups, 0);
});

test("usable original Order fields are returned", async () => {
  const result = await loadRecoveryCheckoutOrder("ord_internal_1", {
    order: {
      findUnique: async (args) => {
        assert.equal(args.where.id, "ord_internal_1");
        return {
          razorpayOrderId: "order_original",
          amount: 349900,
          currency: "INR",
        };
      },
    },
  });

  assert.deepEqual(result, {
    razorpayOrderId: "order_original",
    amount: 349900,
    currency: "INR",
  });
});

test("missing or unusable Order fields fail closed", async () => {
  assert.equal(
    await loadRecoveryCheckoutOrder("ord_missing", {
      order: { findUnique: async () => null },
    }),
    null,
  );
  assert.equal(
    await loadRecoveryCheckoutOrder("ord_bad_amount", {
      order: {
        findUnique: async () => ({
          razorpayOrderId: "order_original",
          amount: 0,
          currency: "INR",
        }),
      },
    }),
    null,
  );
});
