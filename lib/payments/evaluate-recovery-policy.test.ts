import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateRecoveryPolicy } from "./evaluate-recovery-policy.ts";
import type { RecoveryProposalResult } from "./propose-recovery-action.ts";

const validProposal: RecoveryProposalResult = {
  proposed: true,
  action: "REOPEN_CHECKOUT",
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
};

const unresolvedConsideredProposal: RecoveryProposalResult = {
  proposed: true,
  action: "REOPEN_CHECKOUT",
  guardianState: "UNRESOLVED",
  failureCategory: null,
};

const confirmedPolicy = {
  requireConfirmedFailure: true,
  maxRecoveryAttempts: 1,
} as const;

test("1. valid proposal + attemptCount 0 → ALLOW", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: { ...confirmedPolicy },
    attemptCount: 0,
  });

  assert.deepEqual(result, {
    allowed: true,
    action: "REOPEN_CHECKOUT",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
  });
});

test("2. attemptCount 1 with max 1 → MAX_ATTEMPTS_REACHED", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: { ...confirmedPolicy },
    attemptCount: 1,
  });

  assert.deepEqual(result, {
    allowed: false,
    action: "REOPEN_CHECKOUT",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    reason: "MAX_ATTEMPTS_REACHED",
  });
});

test("3. maxRecoveryAttempts 0 → MAX_ATTEMPTS_REACHED", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: {
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 0,
    },
    attemptCount: 0,
  });

  assert.deepEqual(result, {
    allowed: false,
    action: "REOPEN_CHECKOUT",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    reason: "MAX_ATTEMPTS_REACHED",
  });
});

test("4. proposed:false → NO_PROPOSAL", () => {
  const result = evaluateRecoveryPolicy({
    proposal: {
      proposed: false,
      action: null,
      guardianState: "UNRESOLVED",
      failureCategory: null,
      reason: "NOT_VERIFIED",
    },
    policy: { ...confirmedPolicy },
    attemptCount: 0,
  });

  assert.deepEqual(result, {
    allowed: false,
    action: null,
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "NO_PROPOSAL",
  });
});

test("5. forged proposed:true with wrong Guardian state → INCONSISTENT_PROPOSAL", () => {
  const result = evaluateRecoveryPolicy({
    proposal: {
      proposed: true,
      action: "REOPEN_CHECKOUT",
      guardianState: "SUCCESS",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    } as RecoveryProposalResult,
    policy: { ...confirmedPolicy },
    attemptCount: 0,
  });

  assert.equal(result.allowed, false);
  if (result.allowed) {
    return;
  }

  assert.equal(result.reason, "INCONSISTENT_PROPOSAL");
  assert.notEqual(result.allowed, true);
});

test("6. forged proposed:true with wrong action → INCONSISTENT_PROPOSAL", () => {
  const result = evaluateRecoveryPolicy({
    proposal: {
      proposed: true,
      action: "RETRY_PAYMENT",
      guardianState: "FAILED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    } as RecoveryProposalResult,
    policy: { ...confirmedPolicy },
    attemptCount: 0,
  });

  assert.equal(result.allowed, false);
  if (result.allowed) {
    return;
  }

  assert.equal(result.reason, "INCONSISTENT_PROPOSAL");
});

test("7. policy:null → MISSING_POLICY", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: null,
    attemptCount: 0,
  });

  assert.deepEqual(result, {
    allowed: false,
    action: "REOPEN_CHECKOUT",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    reason: "MISSING_POLICY",
  });
});

test("8. negative maxRecoveryAttempts → INVALID_POLICY", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: {
      requireConfirmedFailure: true,
      maxRecoveryAttempts: -1,
    },
    attemptCount: 0,
  });

  assert.equal(result.allowed, false);
  if (result.allowed) {
    return;
  }

  assert.equal(result.reason, "INVALID_POLICY");
});

test("9. non-integer maxRecoveryAttempts → INVALID_POLICY", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: {
      requireConfirmedFailure: true,
      maxRecoveryAttempts: 1.5,
    },
    attemptCount: 0,
  });

  assert.equal(result.allowed, false);
  if (result.allowed) {
    return;
  }

  assert.equal(result.reason, "INVALID_POLICY");
});

test("10. negative attemptCount → INVALID_POLICY", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: { ...confirmedPolicy },
    attemptCount: -1,
  });

  assert.equal(result.allowed, false);
  if (result.allowed) {
    return;
  }

  assert.equal(result.reason, "INVALID_POLICY");
});

test("11. non-integer attemptCount → INVALID_POLICY", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: { ...confirmedPolicy },
    attemptCount: 0.5,
  });

  assert.equal(result.allowed, false);
  if (result.allowed) {
    return;
  }

  assert.equal(result.reason, "INVALID_POLICY");
});

test("12. requireConfirmedFailure:false still ALLOWs confirmed proposal", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: {
      requireConfirmedFailure: false,
      maxRecoveryAttempts: 1,
    },
    attemptCount: 0,
  });

  assert.deepEqual(result, {
    allowed: true,
    action: "REOPEN_CHECKOUT",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
  });
});

test("13. allowed result has no execution/session/Decision/Razorpay/method/AI fields", () => {
  const result = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: { ...confirmedPolicy },
    attemptCount: 0,
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(Object.keys(result).sort(), [
    "action",
    "failureCategory",
    "guardianState",
    "allowed",
  ].sort());
  assert.equal("executedAction" in result, false);
  assert.equal("recoverySessionId" in result, false);
  assert.equal("decisionId" in result, false);
  assert.equal("razorpayPaymentId" in result, false);
  assert.equal("razorpayOrderId" in result, false);
  assert.equal("paymentMethod" in result, false);
  assert.equal("attemptCount" in result, false);
  assert.equal("aiRecommendation" in result, false);
});

test("14. UNRESOLVED considered REOPEN_CHECKOUT + requireConfirmedFailure → CONFIRMED_FAILURE_REQUIRED", () => {
  const result = evaluateRecoveryPolicy({
    proposal: unresolvedConsideredProposal,
    policy: { ...confirmedPolicy },
    attemptCount: 0,
  });

  assert.deepEqual(result, {
    allowed: false,
    action: "REOPEN_CHECKOUT",
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "CONFIRMED_FAILURE_REQUIRED",
  });
  assert.notEqual(result.failureCategory, "GENERIC_PAYMENT_FAILED");
  assert.notEqual(result.allowed, true);
});

test("15. UNRESOLVED considered recovery never ALLOWs when requireConfirmedFailure is false", () => {
  const result = evaluateRecoveryPolicy({
    proposal: unresolvedConsideredProposal,
    policy: {
      requireConfirmedFailure: false,
      maxRecoveryAttempts: 1,
    },
    attemptCount: 0,
  });

  assert.equal(result.allowed, false);
  if (result.allowed) {
    return;
  }

  assert.equal(result.guardianState, "UNRESOLVED");
  assert.equal(result.failureCategory, null);
  assert.equal(result.reason, "INCONSISTENT_PROPOSAL");
});

test("16. UNRESOLVED with GENERIC_PAYMENT_FAILED is INCONSISTENT_PROPOSAL", () => {
  const result = evaluateRecoveryPolicy({
    proposal: {
      proposed: true,
      action: "REOPEN_CHECKOUT",
      guardianState: "UNRESOLVED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
    } as RecoveryProposalResult,
    policy: { ...confirmedPolicy },
    attemptCount: 0,
  });

  assert.equal(result.allowed, false);
  if (result.allowed) {
    return;
  }

  assert.equal(result.reason, "INCONSISTENT_PROPOSAL");
  assert.notEqual(result.reason, "CONFIRMED_FAILURE_REQUIRED");
});

test("17. UNRESOLVED considered + missing policy → MISSING_POLICY", () => {
  const result = evaluateRecoveryPolicy({
    proposal: unresolvedConsideredProposal,
    policy: null,
    attemptCount: 0,
  });

  assert.deepEqual(result, {
    allowed: false,
    action: "REOPEN_CHECKOUT",
    guardianState: "UNRESOLVED",
    failureCategory: null,
    reason: "MISSING_POLICY",
  });
});

test("18. UNRESOLVED considered does not change FAILED max-attempt BLOCK", () => {
  const unresolved = evaluateRecoveryPolicy({
    proposal: unresolvedConsideredProposal,
    policy: { ...confirmedPolicy },
    attemptCount: 1,
  });
  const maxAttempts = evaluateRecoveryPolicy({
    proposal: validProposal,
    policy: { ...confirmedPolicy },
    attemptCount: 1,
  });

  assert.equal(unresolved.allowed, false);
  if (unresolved.allowed) {
    return;
  }

  assert.equal(unresolved.reason, "CONFIRMED_FAILURE_REQUIRED");
  assert.deepEqual(maxAttempts, {
    allowed: false,
    action: "REOPEN_CHECKOUT",
    guardianState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    reason: "MAX_ATTEMPTS_REACHED",
  });
});
