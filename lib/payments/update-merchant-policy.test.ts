import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_MERCHANT_ID } from "../merchants/demo-merchant.ts";
import { updateMerchantPolicy } from "./update-merchant-policy.ts";
import type { LoadedMerchantPolicy } from "./load-merchant-policy.ts";

test("updates only editable fields and leaves action fields unchanged", async () => {
  const updatedAt = new Date("2026-09-04T11:00:00.000Z");
  let wrote: unknown;

  const result = await updateMerchantPolicy(
    {
      requireConfirmedFailure: false,
      maxRecoveryAttempts: 2,
      allowAlternativeMethod: false,
    },
    {
      merchantPolicy: {
        async findUnique() {
          return { merchantId: DEMO_MERCHANT_ID };
        },
        async update(args) {
          wrote = args.data;
          assert.equal("unknownStateAction" in args.data, false);
          assert.equal("riskFailureAction" in args.data, false);
          const policy: LoadedMerchantPolicy = {
            merchantId: DEMO_MERCHANT_ID,
            requireConfirmedFailure: args.data.requireConfirmedFailure,
            maxRecoveryAttempts: args.data.maxRecoveryAttempts,
            allowAlternativeMethod: args.data.allowAlternativeMethod,
            unknownStateAction: "BLOCK",
            riskFailureAction: "BLOCK",
            updatedAt,
          };
          return policy;
        },
      },
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(wrote, {
    requireConfirmedFailure: false,
    maxRecoveryAttempts: 2,
    allowAlternativeMethod: false,
  });
  if (result.ok) {
    assert.equal(result.policy.unknownStateAction, "BLOCK");
    assert.equal(result.policy.riskFailureAction, "BLOCK");
  }
});

test("missing policy performs no write", async () => {
  let updated = false;
  const result = await updateMerchantPolicy(
    {
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 1,
      allowAlternativeMethod: true,
    },
    {
      merchantPolicy: {
        async findUnique() {
          return null;
        },
        async update() {
          updated = true;
          throw new Error("unexpected update");
        },
      },
    },
  );

  assert.deepEqual(result, { ok: false, reason: "POLICY_NOT_FOUND" });
  assert.equal(updated, false);
});
