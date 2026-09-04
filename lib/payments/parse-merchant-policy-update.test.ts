import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMerchantPolicyUpdate } from "./parse-merchant-policy-update.ts";

test("accepts bounded boolean/integer policy update", () => {
  assert.deepEqual(
    parseMerchantPolicyUpdate({
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 1,
      allowAlternativeMethod: false,
    }),
    {
      ok: true,
      update: {
        requireConfirmedFailure: true,
        maxRecoveryAttempts: 1,
        allowAlternativeMethod: false,
      },
    },
  );
});

test("rejects string booleans, out-of-range attempts, and action strings", () => {
  assert.deepEqual(
    parseMerchantPolicyUpdate({
      requireConfirmedFailure: "true",
      maxRecoveryAttempts: 1,
      allowAlternativeMethod: true,
    }),
    { ok: false, reason: "INVALID_INPUT" },
  );
  assert.deepEqual(
    parseMerchantPolicyUpdate({
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 4,
      allowAlternativeMethod: true,
    }),
    { ok: false, reason: "INVALID_INPUT" },
  );
  assert.deepEqual(
    parseMerchantPolicyUpdate({
      requireConfirmedFailure: true,
      maxRecoveryAttempts: -1,
      allowAlternativeMethod: true,
    }),
    { ok: false, reason: "INVALID_INPUT" },
  );
  assert.deepEqual(
    parseMerchantPolicyUpdate({
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 1.5,
      allowAlternativeMethod: true,
    }),
    { ok: false, reason: "INVALID_INPUT" },
  );
});

test("rejects attempts to set read-only or authority-bearing fields", () => {
  const valid = {
    requireConfirmedFailure: true,
    maxRecoveryAttempts: 1,
    allowAlternativeMethod: true,
  };

  assert.deepEqual(
    parseMerchantPolicyUpdate({
      ...valid,
      unknownStateAction: "ALLOW",
    }),
    { ok: false, reason: "INVALID_INPUT" },
  );
  assert.deepEqual(
    parseMerchantPolicyUpdate({
      ...valid,
      riskFailureAction: "ALLOW",
    }),
    { ok: false, reason: "INVALID_INPUT" },
  );
  assert.deepEqual(
    parseMerchantPolicyUpdate({
      ...valid,
      merchantId: "other_merchant",
    }),
    { ok: false, reason: "INVALID_INPUT" },
  );
});
