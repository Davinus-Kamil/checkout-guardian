"use client";

import { useRef, useState } from "react";
import {
  interpretRecoverPaymentHttpResponse,
  RECOVER_PAYMENT_NOT_FOUND_MAX_ATTEMPTS,
  RECOVER_PAYMENT_NOT_FOUND_RETRY_DELAY_MS,
  shouldRetryRecoverPayment,
  type RecoverPaymentClientOutcome,
  type RecoverPaymentClientResult,
  type RecoveryCheckoutInstructions,
} from "@/lib/payments/interpret-recover-payment-client";
import {
  loadRazorpayCheckout,
  type RazorpayCheckoutResponse,
  type RazorpayPaymentFailedEvent,
} from "@/lib/razorpay/load-checkout";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 5;

const CHECKING_RECOVERY_MESSAGE =
  "Payment failed. Guardian is checking whether it is safe to recover.";
const AUTHORIZED_RECOVERY_MESSAGE =
  "Guardian verified this failure and authorized a safe recovery attempt.";
const LOCAL_PAYMENT_MISSING_MESSAGE =
  "Payment failed. Guardian could not verify the local payment record yet. Please wait before trying again.";
const RECOVERY_NOT_AUTHORIZED_MESSAGE =
  "Payment failed. Guardian did not authorize another payment attempt.";
const RECOVERY_UNSAFE_MESSAGE =
  "Payment failed. Guardian could not safely verify recovery. Please do not pay again yet.";
const UNIDENTIFIED_PAYMENT_MESSAGE =
  "This payment could not be identified. Guardian still needs a verified payment identity before recovery can be considered.";

type CreatedOrder = {
  id: string;
  amount: number | string;
  currency: string;
};

export default function PurchasePanel() {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const [failedPaymentId, setFailedPaymentId] = useState<string | null>(null);
  const [paymentFailedMessage, setPaymentFailedMessage] = useState<
    string | null
  >(null);
  const handledFailedPaymentIds = useRef(new Set<string>());

  function readFailedPaymentId(
    response: RazorpayPaymentFailedEvent,
  ): string | null {
    const paymentId = response.error?.metadata?.payment_id;

    if (typeof paymentId !== "string" || !paymentId.trim()) {
      return null;
    }

    return paymentId.trim();
  }

  function wait(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function messageForRecoverOutcome(
    outcome: RecoverPaymentClientOutcome,
  ): string {
    if (outcome === "started") {
      return AUTHORIZED_RECOVERY_MESSAGE;
    }

    if (outcome === "payment_not_found") {
      return LOCAL_PAYMENT_MISSING_MESSAGE;
    }

    if (outcome === "denied") {
      return RECOVERY_NOT_AUTHORIZED_MESSAGE;
    }

    return RECOVERY_UNSAFE_MESSAGE;
  }

  async function postRecoverPayment(
    razorpayPaymentId: string,
  ): Promise<RecoverPaymentClientResult> {
    try {
      const response = await fetch("/api/payments/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razorpay_payment_id: razorpayPaymentId }),
      });
      const payload: unknown = await response.json().catch(() => null);
      return interpretRecoverPaymentHttpResponse(response.status, payload);
    } catch {
      return { outcome: "unsafe" };
    }
  }

  async function openRecoveryCheckout(checkout: RecoveryCheckoutInstructions) {
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    if (!keyId) {
      setPaymentFailedMessage(RECOVERY_UNSAFE_MESSAGE);
      return;
    }

    try {
      const RazorpayCheckout = await loadRazorpayCheckout();
      const recoveryCheckout = new RazorpayCheckout({
        key: keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "Auralis",
        description: "Premium Headphones",
        order_id: checkout.orderId,
        theme: { color: "#8a4b1f" },
        handler(payment) {
          void verifyPayment(payment);
        },
      });

      recoveryCheckout.on("payment.failed", () => {
        setPaymentFailedMessage(RECOVERY_NOT_AUTHORIZED_MESSAGE);
      });

      recoveryCheckout.open();
    } catch {
      setPaymentFailedMessage(RECOVERY_UNSAFE_MESSAGE);
    }
  }

  async function runRecoverPaymentWorkflow(razorpayPaymentId: string) {
    let result: RecoverPaymentClientResult = { outcome: "unsafe" };

    for (
      let attempt = 1;
      attempt <= RECOVER_PAYMENT_NOT_FOUND_MAX_ATTEMPTS;
      attempt += 1
    ) {
      result = await postRecoverPayment(razorpayPaymentId);

      if (!shouldRetryRecoverPayment(result.outcome, attempt)) {
        break;
      }

      await wait(RECOVER_PAYMENT_NOT_FOUND_RETRY_DELAY_MS);
    }

    setPaymentFailedMessage(messageForRecoverOutcome(result.outcome));

    if (result.outcome === "started") {
      void openRecoveryCheckout(result.checkout);
    }
  }

  function decreaseQuantity() {
    setQuantity((current) => Math.max(MIN_QUANTITY, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(MAX_QUANTITY, current + 1));
  }

  async function handleBuyNow() {
    setErrorMessage(null);
    setVerificationMessage(null);
    setFailedPaymentId(null);
    setPaymentFailedMessage(null);
    setIsStartingCheckout(true);

    try {
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!keyId) {
        throw new Error(
          "Checkout is not configured. Set NEXT_PUBLIC_RAZORPAY_KEY_ID.",
        );
      }

      const response = await fetch("/api/orders", { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const apiError =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Could not create the order. Please try again.";
        throw new Error(apiError);
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        !("id" in payload) ||
        typeof payload.id !== "string" ||
        !("amount" in payload) ||
        !("currency" in payload) ||
        typeof payload.currency !== "string"
      ) {
        throw new Error("Received an invalid order response.");
      }

      const order = payload as CreatedOrder;
      const RazorpayCheckout = await loadRazorpayCheckout();

      const checkout = new RazorpayCheckout({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Auralis",
        description: "Premium Headphones",
        order_id: order.id,
        theme: { color: "#8a4b1f" },
        handler(payment) {
          void verifyPayment(payment);
        },
      });

      checkout.on("payment.failed", (response) => {
        const capturedPaymentId = readFailedPaymentId(response);

        if (!capturedPaymentId) {
          setFailedPaymentId(null);
          setPaymentFailedMessage(UNIDENTIFIED_PAYMENT_MESSAGE);
          return;
        }

        if (handledFailedPaymentIds.current.has(capturedPaymentId)) {
          return;
        }

        handledFailedPaymentIds.current.add(capturedPaymentId);

        setFailedPaymentId(capturedPaymentId);
        setPaymentFailedMessage(CHECKING_RECOVERY_MESSAGE);
        void runRecoverPaymentWorkflow(capturedPaymentId);
      });

      checkout.open();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Checkout could not be started. Please try again.",
      );
    } finally {
      setIsStartingCheckout(false);
    }
  }

  async function verifyPayment(payment: RazorpayCheckoutResponse) {
    setErrorMessage(null);
    setVerificationMessage(null);
    setIsVerifyingPayment(true);

    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_order_id: payment.razorpay_order_id,
          razorpay_signature: payment.razorpay_signature,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const verified =
        payload &&
        typeof payload === "object" &&
        "verified" in payload &&
        payload.verified === true;

      if (!verified) {
        throw new Error("Payment could not be verified. Please try again.");
      }

      setVerificationMessage("Payment verified successfully");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Payment could not be verified. Please try again.",
      );
    } finally {
      setIsVerifyingPayment(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium tracking-wide text-muted uppercase">
          Quantity
        </span>
        <div className="inline-flex items-center rounded-full border border-line bg-background">
          <button
            type="button"
            onClick={decreaseQuantity}
            disabled={quantity <= MIN_QUANTITY || isStartingCheckout}
            aria-label="Decrease quantity"
            className="flex h-11 w-11 items-center justify-center rounded-l-full text-lg disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-8 text-center text-base font-medium tabular-nums">
            {quantity}
          </span>
          <button
            type="button"
            onClick={increaseQuantity}
            disabled={quantity >= MAX_QUANTITY || isStartingCheckout}
            aria-label="Increase quantity"
            className="flex h-11 w-11 items-center justify-center rounded-r-full text-lg disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleBuyNow}
        disabled={isStartingCheckout}
        className="flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-base font-semibold tracking-wide text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {isStartingCheckout ? "Starting checkout…" : "Buy Now"}
      </button>

      {errorMessage ? (
        <p role="alert" className="text-sm leading-6 text-accent">
          {errorMessage}
        </p>
      ) : null}

      {paymentFailedMessage ? (
        <p
          role="status"
          className="text-sm leading-6 text-muted"
          data-failed-payment-captured={failedPaymentId ? "true" : "false"}
        >
          {paymentFailedMessage}
        </p>
      ) : null}

      {isVerifyingPayment ? (
        <p className="text-sm leading-6 text-muted">Verifying payment…</p>
      ) : null}

      {verificationMessage ? (
        <p className="text-sm leading-6 text-muted">{verificationMessage}</p>
      ) : null}

      <p className="text-sm leading-6 text-muted">
        Secure checkout · 7-day easy returns · Support available 9am–9pm IST
      </p>
    </div>
  );
}
