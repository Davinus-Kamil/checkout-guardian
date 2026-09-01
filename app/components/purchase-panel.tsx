"use client";

import { useState } from "react";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 5;

export default function PurchasePanel() {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);

  function decreaseQuantity() {
    setQuantity((current) => Math.max(MIN_QUANTITY, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(MAX_QUANTITY, current + 1));
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
            disabled={quantity <= MIN_QUANTITY}
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
            disabled={quantity >= MAX_QUANTITY}
            aria-label="Increase quantity"
            className="flex h-11 w-11 items-center justify-center rounded-r-full text-lg disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        className="flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-base font-semibold tracking-wide text-white transition-colors hover:bg-accent-hover"
      >
        Buy Now
      </button>

      <p className="text-sm leading-6 text-muted">
        Secure checkout · 7-day easy returns · Support available 9am–9pm IST
      </p>
    </div>
  );
}
