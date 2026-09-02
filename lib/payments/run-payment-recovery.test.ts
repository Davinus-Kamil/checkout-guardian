import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecoveryEligibilityResult } from "./derive-recovery-eligibility.ts";
import type { PolicyGateResult } from "./evaluate-recovery-policy.ts";
import type { RecoveryGateContextResult } from "./load-recovery-gate-context.ts";
import type { PersistRecoveryGateDecisionResult } from "./persist-recovery-gate-decision.ts";
import type { RecoveryProposalResult } from "./propose-recovery-action.ts";
import {
  parseRecoverPaymentBody,
  recoveryHttpStatus,
  runPaymentRecovery,
  type RunPaymentRecoveryDeps,
} from "./run-payment-recovery.ts";
import type { StartRecoveryAttemptResult } from "./start-authorized-recovery.ts";
import type { PaymentVerificationResult } from "./verify-razorpay-payment-state.ts";

const RAZORPAY_PAYMENT_ID = "pay_recover_1";
const PAYMENT_ID = "pay_internal_1";
const ORDER_ID = "ord_internal_1";
const SESSION_ID = "rsess_1";
const DECISION_ID = "dec_1";

const failedFacts = {
  normalizedStatus: "failed" as const,
  paymentMethod: "card",
  errorCode: "BAD_REQUEST_ERROR",
  errorReason: "payment_failed",
  isCaptured: false,
  isFailed: true,
};

const recoverableVerification: PaymentVerificationResult = {
  verified: true,
  razorpayPaymentId: RAZORPAY_PAYMENT_ID,
  gatewayStatus: "failed",
  facts: failedFacts,
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
};

const eligible: RecoveryEligibilityResult = {
  eligible: true,
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
};

const proposal: RecoveryProposalResult = {
  proposed: true,
  action: "REOPEN_CHECKOUT",
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
};

const allowGate: PolicyGateResult = {
  allowed: true,
  action: "REOPEN_CHECKOUT",
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
};

const blockMaxAttempts: PolicyGateResult = {
  allowed: false,
  action: "REOPEN_CHECKOUT",
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
  reason: "MAX_ATTEMPTS_REACHED",
};

const allowContext: Extract<RecoveryGateContextResult, { ok: true }> = {
  ok: true,
  paymentId: PAYMENT_ID,
  orderId: ORDER_ID,
  merchantId: "merch_1",
  policy: {
    requireConfirmedFailure: true,
    maxRecoveryAttempts: 1,
  },
  attemptCount: 0,
  recoverySessionId: null,
};

function unused(): never {
  throw new Error("unexpected downstream call");
}

function createDeps(
  overrides: Partial<RunPaymentRecoveryDeps> & { calls?: string[] },
): RunPaymentRecoveryDeps {
  const calls = overrides.calls ?? [];

  return {
    verifyPaymentState: async () => {
      calls.push("verify");
      return recoverableVerification;
    },
    deriveEligibility: () => {
      calls.push("eligibility");
      return eligible;
    },
    proposeAction: () => {
      calls.push("propose");
      return proposal;
    },
    loadContext: async () => {
      calls.push("context");
      return allowContext;
    },
    evaluatePolicy: (input) => {
      calls.push("gate");
      assert.equal(input.attemptCount, allowContext.attemptCount);
      return allowGate;
    },
    persistDecision: async () => {
      calls.push("persist");
      return {
        persisted: true,
        recoverySessionId: SESSION_ID,
        decisionId: DECISION_ID,
        policyResult: "ALLOW",
        policyReason: null,
      };
    },
    startAuthorized: async () => {
      calls.push("start");
      return {
        started: true,
        recoverySessionId: SESSION_ID,
        decisionId: DECISION_ID,
        action: "REOPEN_CHECKOUT",
        attemptCount: 1,
        sessionStatus: "IN_PROGRESS",
      };
    },
    ...overrides,
    calls,
  } as RunPaymentRecoveryDeps & { calls: string[] };
}

test("1. M10 verified false stops immediately", async () => {
  const calls: string[] = [];
  const result = await runPaymentRecovery(RAZORPAY_PAYMENT_ID, {
    verifyPaymentState: async () => {
      calls.push("verify");
      return {
        verified: false,
        razorpayPaymentId: RAZORPAY_PAYMENT_ID,
        guardianState: "UNRESOLVED",
        failureCategory: null,
        reason: "FETCH_FAILED",
      };
    },
    deriveEligibility: unused,
    proposeAction: unused,
    loadContext: unused,
    evaluatePolicy: unused,
    persistDecision: unused,
    startAuthorized: unused,
  });

  assert.deepEqual(result, { started: false, reason: "FETCH_FAILED" });
  assert.deepEqual(calls, ["verify"]);
  assert.equal(recoveryHttpStatus(result), 200);
});

test("2. SUCCESS is blocked by M11 with no context/persistence/start", async () => {
  const calls: string[] = [];
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      calls,
      verifyPaymentState: async () => {
        calls.push("verify");
        return {
          verified: true,
          razorpayPaymentId: RAZORPAY_PAYMENT_ID,
          gatewayStatus: "captured",
          facts: {
            normalizedStatus: "captured",
            paymentMethod: "card",
            errorCode: null,
            errorReason: null,
            isCaptured: true,
            isFailed: false,
          },
          guardianState: "SUCCESS",
          failureCategory: null,
        };
      },
      deriveEligibility: (verification) => {
        calls.push("eligibility");
        assert.equal(verification.guardianState, "SUCCESS");
        return {
          eligible: false,
          guardianState: "SUCCESS",
          failureCategory: null,
          reason: "ALREADY_SUCCEEDED",
        };
      },
      proposeAction: unused,
      loadContext: unused,
      persistDecision: unused,
      startAuthorized: unused,
    }),
  );

  assert.deepEqual(result, {
    started: false,
    reason: "ALREADY_SUCCEEDED",
  });
  assert.deepEqual(calls, ["verify", "eligibility"]);
});

test("3. UNRESOLVED does not persist or start", async () => {
  const calls: string[] = [];
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      calls,
      verifyPaymentState: async () => {
        calls.push("verify");
        return {
          verified: true,
          razorpayPaymentId: RAZORPAY_PAYMENT_ID,
          gatewayStatus: "authorized",
          facts: {
            normalizedStatus: "unknown",
            paymentMethod: "card",
            errorCode: null,
            errorReason: null,
            isCaptured: false,
            isFailed: false,
          },
          guardianState: "UNRESOLVED",
          failureCategory: null,
        };
      },
      deriveEligibility: () => {
        calls.push("eligibility");
        return {
          eligible: false,
          guardianState: "UNRESOLVED",
          failureCategory: null,
          reason: "UNRESOLVED_STATE",
        };
      },
      proposeAction: unused,
      persistDecision: unused,
      startAuthorized: unused,
    }),
  );

  assert.deepEqual(result, {
    started: false,
    reason: "UNRESOLVED_STATE",
  });
  assert.equal(calls.includes("persist"), false);
  assert.equal(calls.includes("start"), false);
});

test("4. UNKNOWN failure category does not persist or start", async () => {
  const calls: string[] = [];
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      calls,
      deriveEligibility: () => {
        calls.push("eligibility");
        return {
          eligible: false,
          guardianState: "FAILED",
          failureCategory: "UNKNOWN",
          reason: "UNKNOWN_FAILURE",
        };
      },
      proposeAction: unused,
      persistDecision: unused,
      startAuthorized: unused,
    }),
  );

  assert.deepEqual(result, {
    started: false,
    reason: "UNKNOWN_FAILURE",
  });
  assert.equal(calls.includes("persist"), false);
  assert.equal(calls.includes("start"), false);
});

test("5. recoverable failure + ALLOW persists then starts in order", async () => {
  const calls: string[] = [];
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({ calls }),
  );

  assert.deepEqual(result, {
    started: true,
    recoverySessionId: SESSION_ID,
    decisionId: DECISION_ID,
    action: "REOPEN_CHECKOUT",
    attemptCount: 1,
    sessionStatus: "IN_PROGRESS",
  });
  assert.deepEqual(calls, [
    "verify",
    "eligibility",
    "propose",
    "context",
    "gate",
    "persist",
    "start",
  ]);
  assert.equal(recoveryHttpStatus(result), 200);
});

test("6. MAX_ATTEMPTS_REACHED persists BLOCK and does not start", async () => {
  const calls: string[] = [];
  const persistInputs: unknown[] = [];
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      calls,
      evaluatePolicy: () => {
        calls.push("gate");
        return blockMaxAttempts;
      },
      persistDecision: async (input) => {
        calls.push("persist");
        persistInputs.push(input);
        return {
          persisted: true,
          recoverySessionId: SESSION_ID,
          decisionId: DECISION_ID,
          policyResult: "BLOCK",
          policyReason: "MAX_ATTEMPTS_REACHED",
        };
      },
      startAuthorized: unused,
    }),
  );

  assert.deepEqual(result, {
    started: false,
    reason: "MAX_ATTEMPTS_REACHED",
    recoverySessionId: SESSION_ID,
    decisionId: DECISION_ID,
    policyResult: "BLOCK",
  });
  assert.equal(calls.includes("start"), false);
  assert.equal(calls.includes("persist"), true);
  assert.equal(recoveryHttpStatus(result), 200);
});

test("7. missing policy persists BLOCK and does not start", async () => {
  const calls: string[] = [];
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      calls,
      loadContext: async () => {
        calls.push("context");
        return { ...allowContext, policy: null };
      },
      evaluatePolicy: (input) => {
        calls.push("gate");
        assert.equal(input.policy, null);
        return {
          allowed: false,
          action: "REOPEN_CHECKOUT",
          guardianState: "FAILED",
          failureCategory: "GENERIC_PAYMENT_FAILED",
          reason: "MISSING_POLICY",
        };
      },
      persistDecision: async () => {
        calls.push("persist");
        return {
          persisted: true,
          recoverySessionId: SESSION_ID,
          decisionId: DECISION_ID,
          policyResult: "BLOCK",
          policyReason: "MISSING_POLICY",
        };
      },
      startAuthorized: unused,
    }),
  );

  assert.deepEqual(result, {
    started: false,
    reason: "MISSING_POLICY",
    recoverySessionId: SESSION_ID,
    decisionId: DECISION_ID,
    policyResult: "BLOCK",
  });
  assert.equal(calls.includes("start"), false);
});

test("8. loader PAYMENT_NOT_FOUND does not persist or start", async () => {
  const calls: string[] = [];
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      calls,
      loadContext: async () => {
        calls.push("context");
        return { ok: false, reason: "PAYMENT_NOT_FOUND" };
      },
      persistDecision: unused,
      startAuthorized: unused,
    }),
  );

  assert.deepEqual(result, {
    started: false,
    reason: "PAYMENT_NOT_FOUND",
  });
  assert.equal(calls.includes("persist"), false);
  assert.equal(calls.includes("start"), false);
  assert.equal(recoveryHttpStatus(result), 200);
});

test("9. persistence failure does not start", async () => {
  const calls: string[] = [];
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      calls,
      persistDecision: async () => {
        calls.push("persist");
        return { persisted: false, reason: "SESSION_MISMATCH" };
      },
      startAuthorized: unused,
    }),
  );

  assert.deepEqual(result, {
    started: false,
    reason: "SESSION_MISMATCH",
  });
  assert.equal(calls.includes("start"), false);
});

test("10. start ALREADY_STARTED is fail-closed", async () => {
  const result = await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      startAuthorized: async () =>
        ({
          started: false,
          reason: "ALREADY_STARTED",
        }) satisfies StartRecoveryAttemptResult,
    }),
  );

  assert.deepEqual(result, {
    started: false,
    reason: "ALREADY_STARTED",
    recoverySessionId: SESSION_ID,
    decisionId: DECISION_ID,
  });
  assert.equal(recoveryHttpStatus(result), 200);
});

test("11. M13 attemptCount comes from the context loader", async () => {
  let seenAttemptCount: number | undefined;
  await runPaymentRecovery(
    RAZORPAY_PAYMENT_ID,
    createDeps({
      loadContext: async () => ({ ...allowContext, attemptCount: 4 }),
      evaluatePolicy: (input) => {
        seenAttemptCount = input.attemptCount;
        return allowGate;
      },
    }),
  );

  assert.equal(seenAttemptCount, 4);
});

test("12. request parser ignores client action/policy/session/Decision IDs", () => {
  const parsed = parseRecoverPaymentBody({
    razorpay_payment_id: RAZORPAY_PAYMENT_ID,
    action: "REOPEN_CHECKOUT",
    policy: { maxRecoveryAttempts: 99 },
    recoverySessionId: "client_session",
    decisionId: "client_decision",
    attemptCount: 0,
  });

  assert.deepEqual(parsed, {
    ok: true,
    razorpayPaymentId: RAZORPAY_PAYMENT_ID,
  });
  assert.equal("action" in parsed, false);
});

test("13. unexpected dependency throw is not converted into success", async () => {
  await assert.rejects(
    () =>
      runPaymentRecovery(RAZORPAY_PAYMENT_ID, {
        verifyPaymentState: async () => {
          throw new Error("razorpay down");
        },
        deriveEligibility: unused,
        proposeAction: unused,
        loadContext: unused,
        evaluatePolicy: unused,
        persistDecision: unused,
        startAuthorized: unused,
      }),
    /razorpay down/,
  );
});

test("HTTP mapping: malformed/blank body and INVALID_PAYMENT_ID are 400", () => {
  assert.deepEqual(parseRecoverPaymentBody(null), { ok: false });
  assert.deepEqual(parseRecoverPaymentBody({ razorpay_payment_id: "  " }), {
    ok: false,
  });
  assert.equal(
    recoveryHttpStatus({ started: false, reason: "INVALID_INPUT" }),
    400,
  );
  assert.equal(
    recoveryHttpStatus({ started: false, reason: "INVALID_PAYMENT_ID" }),
    400,
  );
  assert.equal(
    recoveryHttpStatus({ started: false, reason: "INTERNAL_ERROR" }),
    500,
  );
});
