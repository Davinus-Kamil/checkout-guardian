"use client";

import { useState } from "react";
import { loadRazorpayCheckout } from "@/lib/razorpay/load-checkout";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 5;

type CreatedOrder = {
  id: string;
  amount: number | string;
  currency: string;
};

export default function PurchasePanel() {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unverifiedPaymentIds, setUnverifiedPaymentIds] = useState<
    string | null
  >(null);

  function decreaseQuantity() {
    setQuantity((current) => Math.max(MIN_QUANTITY, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(MAX_QUANTITY, current + 1));
  }

  async function handleBuyNow() {
    setErrorMessage(null);
    setUnverifiedPaymentIds(null);
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
          console.info("Unverified Razorpay payment identifiers", {
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_signature: payment.razorpay_signature,
          });
          setUnverifiedPaymentIds(
            `Unverified payment ${payment.razorpay_payment_id} for order ${payment.razorpay_order_id}`,
          );
        },
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

      {unverifiedPaymentIds ? (
        <p className="text-sm leading-6 text-muted">{unverifiedPaymentIds}</p>
      ) : null}

      <p className="text-sm leading-6 text-muted">
        Secure checkout · 7-day easy returns · Support available 9am–9pm IST
      </p>
    </div>
  );
}
