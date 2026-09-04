import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveRecoveryPortfolioClassification,
  type RecoveryPortfolioFacts,
} from "./derive-recovery-portfolio.ts";

function facts(
  overrides: Partial<RecoveryPortfolioFacts> = {},
): RecoveryPortfolioFacts {
  return {
    sessionStatus: "OPEN",
    paymentState: "FAILED",
    failureCategory: "GENERIC_PAYMENT_FAILED",
    policyResult: "ALLOW",
    policyReason: null,
    outcome: null,
    recoveredAmount: null,
    attemptCount: 0,
    ...overrides,
  };
}

test("A. COMPLETED + RECOVERED + positive recoveredAmount -> RECOVERED", () => {
  assert.equal(
    deriveRecoveryPortfolioClassification(
      facts({
        sessionStatus: "COMPLETED",
        outcome: "RECOVERED",
        recoveredAmount: 349900,
        policyResult: "ALLOW",
        attemptCount: 1,
      }),
    ),
    "RECOVERED",
  );
});

test("B. ALLOW without RECOVERED outcome must not become RECOVERED", () => {
  assert.notEqual(
    deriveRecoveryPortfolioClassification(
      facts({
        sessionStatus: "COMPLETED",
        policyResult: "ALLOW",
        outcome: null,
        recoveredAmount: 349900,
      }),
    ),
    "RECOVERED",
  );
  assert.notEqual(
    deriveRecoveryPortfolioClassification(
      facts({
        sessionStatus: "OPEN",
        policyResult: "ALLOW",
        outcome: null,
      }),
    ),
    "RECOVERED",
  );
});

test("C. BLOCK + MAX_ATTEMPTS_REACHED -> STOPPED", () => {
  assert.equal(
    deriveRecoveryPortfolioClassification(
      facts({
        policyResult: "BLOCK",
        policyReason: "MAX_ATTEMPTS_REACHED",
        sessionStatus: "OPEN",
        attemptCount: 1,
      }),
    ),
    "STOPPED",
  );
});

test("C2. MAX_ATTEMPTS_REACHED outranks HOLD_ESCALATE", () => {
  assert.equal(
    deriveRecoveryPortfolioClassification(
      facts({
        paymentState: "UNRESOLVED",
        failureCategory: null,
        policyResult: "BLOCK",
        policyReason: "MAX_ATTEMPTS_REACHED",
      }),
    ),
    "STOPPED",
  );
});

test("D. UNRESOLVED + BLOCK + CONFIRMED_FAILURE_REQUIRED -> HOLD_ESCALATE", () => {
  assert.equal(
    deriveRecoveryPortfolioClassification(
      facts({
        paymentState: "UNRESOLVED",
        failureCategory: null,
        policyResult: "BLOCK",
        policyReason: "CONFIRMED_FAILURE_REQUIRED",
        sessionStatus: "OPEN",
        attemptCount: 0,
      }),
    ),
    "HOLD_ESCALATE",
  );
});

test("E. FAILED + GENERIC_PAYMENT_FAILED + ALLOW + OPEN -> RECOVERABLE", () => {
  assert.equal(
    deriveRecoveryPortfolioClassification(facts({ sessionStatus: "OPEN" })),
    "RECOVERABLE",
  );
});

test("F. confirmed allowed failure + IN_PROGRESS -> RECOVERABLE", () => {
  assert.equal(
    deriveRecoveryPortfolioClassification(
      facts({
        sessionStatus: "IN_PROGRESS",
        attemptCount: 1,
      }),
    ),
    "RECOVERABLE",
  );
});

test("G. UNRESOLVED must never classify RECOVERABLE", () => {
  const unresolvedCases: RecoveryPortfolioFacts[] = [
    facts({
      paymentState: "UNRESOLVED",
      failureCategory: null,
      policyResult: "BLOCK",
      policyReason: "CONFIRMED_FAILURE_REQUIRED",
    }),
    facts({
      paymentState: "UNRESOLVED",
      failureCategory: "GENERIC_PAYMENT_FAILED",
      policyResult: "ALLOW",
      policyReason: null,
      sessionStatus: "OPEN",
    }),
    facts({
      paymentState: "UNRESOLVED",
      failureCategory: null,
      policyResult: "ALLOW",
      sessionStatus: "IN_PROGRESS",
    }),
  ];

  for (const input of unresolvedCases) {
    assert.notEqual(
      deriveRecoveryPortfolioClassification(input),
      "RECOVERABLE",
    );
  }
});

test("H. SUCCESS without a valid recovered outcome -> STOPPED", () => {
  assert.equal(
    deriveRecoveryPortfolioClassification(
      facts({
        paymentState: "SUCCESS",
        failureCategory: null,
        policyResult: "ALLOW",
        sessionStatus: "OPEN",
        outcome: null,
      }),
    ),
    "STOPPED",
  );
  assert.equal(
    deriveRecoveryPortfolioClassification(
      facts({
        paymentState: "SUCCESS",
        sessionStatus: "COMPLETED",
        outcome: "RECOVERED",
        recoveredAmount: null,
      }),
    ),
    "STOPPED",
  );
});

test("I. RECOVERED outcome with zero/null recoveredAmount must not claim RECOVERED", () => {
  assert.notEqual(
    deriveRecoveryPortfolioClassification(
      facts({
        sessionStatus: "COMPLETED",
        outcome: "RECOVERED",
        recoveredAmount: 0,
      }),
    ),
    "RECOVERED",
  );
  assert.notEqual(
    deriveRecoveryPortfolioClassification(
      facts({
        sessionStatus: "COMPLETED",
        outcome: "RECOVERED",
        recoveredAmount: null,
      }),
    ),
    "RECOVERED",
  );
  assert.notEqual(
    deriveRecoveryPortfolioClassification(
      facts({
        sessionStatus: "COMPLETED",
        outcome: "RECOVERED",
        recoveredAmount: 100.5,
      }),
    ),
    "RECOVERED",
  );
});

test("J. inconsistent/malformed combinations fail closed and must not classify RECOVERABLE", () => {
  const closed: RecoveryPortfolioFacts[] = [
    facts({
      sessionStatus: "COMPLETED",
      policyResult: "ALLOW",
      outcome: null,
    }),
    facts({
      failureCategory: "UNKNOWN",
      policyResult: "ALLOW",
    }),
    facts({
      paymentState: "FAILED",
      failureCategory: null,
      policyResult: "ALLOW",
    }),
    facts({
      policyResult: "BLOCK",
      policyReason: "CONFIRMED_FAILURE_REQUIRED",
      paymentState: "FAILED",
    }),
    facts({
      policyResult: "ALLOW",
      policyReason: "MAX_ATTEMPTS_REACHED",
    }),
    facts({
      outcome: "RECOVERED",
      sessionStatus: "OPEN",
      recoveredAmount: 349900,
    }),
    facts({
      sessionStatus: "UNKNOWN_STATUS",
    }),
    facts({
      paymentState: "MAYBE",
    }),
    facts({
      attemptCount: -1,
    }),
    facts({
      attemptCount: 1.5,
    }),
  ];

  for (const input of closed) {
    const classification = deriveRecoveryPortfolioClassification(input);
    assert.notEqual(classification, "RECOVERABLE");
    assert.notEqual(classification, "RECOVERED");
  }
});
