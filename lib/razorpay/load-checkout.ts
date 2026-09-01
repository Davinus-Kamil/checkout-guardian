const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number | string;
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => void;
  theme?: { color?: string };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

type RazorpayCheckoutConstructor = new (
  options: RazorpayCheckoutOptions,
) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutConstructor;
  }
}

function waitForCheckoutScript(script: HTMLScriptElement) {
  return new Promise<RazorpayCheckoutConstructor>((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    script.addEventListener(
      "load",
      () => {
        if (window.Razorpay) {
          resolve(window.Razorpay);
          return;
        }

        reject(new Error("Razorpay Checkout failed to initialize."));
      },
      { once: true },
    );

    script.addEventListener(
      "error",
      () => {
        reject(new Error("Failed to load Razorpay Checkout."));
      },
      { once: true },
    );
  });
}

export function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Razorpay Checkout can only load in the browser."),
    );
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${RAZORPAY_CHECKOUT_SRC}"]`,
  );

  if (existing) {
    return waitForCheckoutScript(existing);
  }

  const script = document.createElement("script");
  script.src = RAZORPAY_CHECKOUT_SRC;
  script.async = true;
  document.body.appendChild(script);

  return waitForCheckoutScript(script);
}
