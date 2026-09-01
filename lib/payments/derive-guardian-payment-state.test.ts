import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveGuardianPaymentState } from "./derive-guardian-payment-state.ts";

test("captured → SUCCESS", () => {
  const result = deriveGuardianPaymentState({ normalizedStatus: "captured" });

  assert.equal(result, "SUCCESS");
  assert.notEqual(result, "FAILED");
});

test("failed → FAILED", () => {
  const result = deriveGuardianPaymentState({ normalizedStatus: "failed" });

  assert.equal(result, "FAILED");
  assert.notEqual(result, "SUCCESS");
});

test("unknown → UNRESOLVED", () => {
  const result = deriveGuardianPaymentState({ normalizedStatus: "unknown" });

  assert.equal(result, "UNRESOLVED");
});
