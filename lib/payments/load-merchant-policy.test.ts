import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_MERCHANT_ID } from "../merchants/demo-merchant.ts";
import { loadMerchantPolicy } from "./load-merchant-policy.ts";

test("loads persisted demo merchant policy without inventing fields", async () => {
  const updatedAt = new Date("2026-09-04T10:00:00.000Z");
  const result = await loadMerchantPolicy({
    merchantPolicy: {
      async findUnique(args) {
        assert.deepEqual(args.where, { merchantId: DEMO_MERCHANT_ID });
        return {
          merchantId: DEMO_MERCHANT_ID,
          requireConfirmedFailure: true,
          maxRecoveryAttempts: 1,
          allowAlternativeMethod: true,
          unknownStateAction: "BLOCK",
          riskFailureAction: "BLOCK",
          updatedAt,
        };
      },
    },
  });

  assert.deepEqual(result, {
    ok: true,
    policy: {
      merchantId: DEMO_MERCHANT_ID,
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 1,
      allowAlternativeMethod: true,
      unknownStateAction: "BLOCK",
      riskFailureAction: "BLOCK",
      updatedAt,
    },
  });
});

test("unknown merchant policy fails closed", async () => {
  const result = await loadMerchantPolicy({
    merchantPolicy: {
      async findUnique() {
        return null;
      },
    },
  });

  assert.deepEqual(result, { ok: false, reason: "POLICY_NOT_FOUND" });
});
