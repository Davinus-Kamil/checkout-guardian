import assert from "node:assert/strict";
import { test } from "node:test";
import {
  messageForVerifiedCheckoutPayment,
  NORMAL_PAYMENT_VERIFIED_MESSAGE,
} from "./interpret-verify-payment-client.ts";

test("verified recovery finalization formats server amount and currency", () => {
  assert.equal(
    messageForVerifiedCheckoutPayment({
      verified: true,
      recovery: {
        finalized: true,
        recoveredAmount: 349900,
        currency: "INR",
      },
    }),
    "Payment recovered successfully. ₹3,499 recovered.",
  );
});

test("ordinary verified success has no recovered-revenue copy", () => {
  assert.equal(
    messageForVerifiedCheckoutPayment({ verified: true }),
    NORMAL_PAYMENT_VERIFIED_MESSAGE,
  );
});

test("malformed recovery metadata must not show recovered revenue copy", () => {
  assert.equal(
    messageForVerifiedCheckoutPayment({
      verified: true,
      recovery: { finalized: true },
    }),
    NORMAL_PAYMENT_VERIFIED_MESSAGE,
  );
  assert.equal(
    messageForVerifiedCheckoutPayment({
      verified: true,
      recovery: {
        finalized: false,
        recoveredAmount: 349900,
        currency: "INR",
      },
    }),
    NORMAL_PAYMENT_VERIFIED_MESSAGE,
  );
  assert.equal(
    messageForVerifiedCheckoutPayment({
      verified: true,
      recovery: {
        finalized: true,
        recoveredAmount: 0,
        currency: "INR",
      },
    }),
    NORMAL_PAYMENT_VERIFIED_MESSAGE,
  );
  assert.equal(
    messageForVerifiedCheckoutPayment({
      verified: true,
      recovery: {
        finalized: true,
        recoveredAmount: 349900,
        currency: "  ",
      },
    }),
    NORMAL_PAYMENT_VERIFIED_MESSAGE,
  );
  assert.equal(
    messageForVerifiedCheckoutPayment({
      verified: true,
      recovery: {
        finalized: true,
        recoveredAmount: 349900.5,
        currency: "INR",
      },
    }),
    NORMAL_PAYMENT_VERIFIED_MESSAGE,
  );
});
