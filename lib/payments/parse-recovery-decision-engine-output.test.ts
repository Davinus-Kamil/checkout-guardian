import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseRecoveryDecisionEngineOutput,
  RECOVERY_DECISION_ENGINE_REASON_MAX_LENGTH,
} from "./parse-recovery-decision-engine-output.ts";

test("valid REOPEN_CHECKOUT parses and trims reason", () => {
  assert.deepEqual(
    parseRecoveryDecisionEngineOutput({
      recommendedAction: "REOPEN_CHECKOUT",
      reason: "  Card failed at issuer; reopen checkout.  ",
    }),
    {
      ok: true,
      recommendedAction: "REOPEN_CHECKOUT",
      reason: "Card failed at issuer; reopen checkout.",
    },
  );
});

test("valid NO_RECOVERY parses", () => {
  assert.deepEqual(
    parseRecoveryDecisionEngineOutput({
      recommendedAction: "NO_RECOVERY",
      reason: "Customer already completed payment.",
    }),
    {
      ok: true,
      recommendedAction: "NO_RECOVERY",
      reason: "Customer already completed payment.",
    },
  );
});

test("malformed and non-object values fail closed", () => {
  assert.deepEqual(parseRecoveryDecisionEngineOutput(null), { ok: false });
  assert.deepEqual(parseRecoveryDecisionEngineOutput("REOPEN_CHECKOUT"), {
    ok: false,
  });
  assert.deepEqual(parseRecoveryDecisionEngineOutput(["REOPEN_CHECKOUT"]), {
    ok: false,
  });
  assert.deepEqual(parseRecoveryDecisionEngineOutput(undefined), { ok: false });
});

test("unsupported action fails closed", () => {
  assert.deepEqual(
    parseRecoveryDecisionEngineOutput({
      recommendedAction: "RETRY_PAYMENT",
      reason: "Try another method.",
    }),
    { ok: false },
  );
  assert.deepEqual(
    parseRecoveryDecisionEngineOutput({
      recommendedAction: "ALLOW",
      reason: "Looks fine.",
    }),
    { ok: false },
  );
});

test("empty and too-long reasons fail closed", () => {
  assert.deepEqual(
    parseRecoveryDecisionEngineOutput({
      recommendedAction: "REOPEN_CHECKOUT",
      reason: "   ",
    }),
    { ok: false },
  );
  assert.deepEqual(
    parseRecoveryDecisionEngineOutput({
      recommendedAction: "REOPEN_CHECKOUT",
      reason: "x".repeat(RECOVERY_DECISION_ENGINE_REASON_MAX_LENGTH + 1),
    }),
    { ok: false },
  );
});

test("authority-bearing extra fields are rejected", () => {
  const reason = "Reopen checkout after confirmed failure.";
  const forbidden = [
    "guardianState",
    "failureCategory",
    "verified",
    "policyResult",
    "executedAction",
    "outcome",
    "recoveredAmount",
    "execute",
  ] as const;

  for (const field of forbidden) {
    assert.deepEqual(
      parseRecoveryDecisionEngineOutput({
        recommendedAction: "REOPEN_CHECKOUT",
        reason,
        [field]: "smuggled",
      }),
      { ok: false },
    );
  }
});

test("parser does not derive payment truth from missing action", () => {
  const result = parseRecoveryDecisionEngineOutput({
    reason: "Looks failed.",
  });

  assert.deepEqual(result, { ok: false });
  assert.equal("guardianState" in result, false);
  assert.equal("failureCategory" in result, false);
  assert.equal("verified" in result, false);
});
