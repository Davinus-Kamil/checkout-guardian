"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  interpretRecoverPaymentHttpResponse,
  recoverPaymentRequestBody,
  RECOVER_PAYMENT_NOT_FOUND_MAX_ATTEMPTS,
  RECOVER_PAYMENT_NOT_FOUND_RETRY_DELAY_MS,
  shouldRetryRecoverPayment,
  type RecoverPaymentClientOutcome,
  type RecoverPaymentClientResult,
  type RecoveryCheckoutInstructions,
} from "@/lib/payments/interpret-recover-payment-client";
import { messageForVerifiedCheckoutPayment } from "@/lib/payments/interpret-verify-payment-client";
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
const RECOVERY_HOLD_MESSAGE =
  "We're confirming your previous payment. Please don't pay again yet.";
const UNIDENTIFIED_PAYMENT_MESSAGE =
  "This payment could not be identified. Guardian still needs a verified payment identity before recovery can be considered.";

function StatusIcon({
  kind,
}: {
  kind: "failed" | "recovery" | "hold" | "recovered" | "success";
}) {
  if (kind === "recovered" || kind === "success") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.03 4.22-3.5 4.5-1.12.07-1.75-1.75 1.06-1.06 1.14 1.14 2.99-3.84 1.18.94Z"
        />
      </svg>
    );
  }

  if (kind === "hold") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <path fill="currentColor" d="M5.25 3h1.5v10h-1.5V3Zm4 0h1.5v10H9.25V3Z" />
      </svg>
    );
  }

  if (kind === "recovery") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5h-1.5A5 5 0 1 1 8 3v1.5L11 2.5 8 .5V1.5Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 1.75 14.5 14.25H1.5L8 1.75ZM8 6.2v3.3h.01V6.2H8Zm0 5.3a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
      />
    </svg>
  );
}

function StatusSurface({
  kind,
  title,
  body,
  failedPaymentCaptured,
  recoveryOutcome,
  role = "status",
}: {
  kind: "failed" | "recovery" | "hold" | "recovered" | "success";
  title: string;
  body: string;
  failedPaymentCaptured?: boolean;
  recoveryOutcome?: RecoverPaymentClientOutcome | null;
  role?: "status" | "alert";
}) {
  const surface =
    kind === "failed"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : kind === "hold"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : kind === "recovered"
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : kind === "recovery"
            ? "border-indigo-200 bg-indigo-50 text-indigo-950"
            : "border-slate-200 bg-slate-50 text-slate-800";
  const icon =
    kind === "failed"
      ? "text-rose-700"
      : kind === "hold"
        ? "text-amber-700"
        : kind === "recovered"
          ? "text-emerald-700"
          : kind === "recovery"
            ? "text-indigo-700"
            : "text-slate-600";

  return (
    <div
      role={role}
      className={`rounded-lg border px-3 py-2 ${surface}`}
      data-failed-payment-captured={
        failedPaymentCaptured === undefined
          ? undefined
          : failedPaymentCaptured
            ? "true"
            : "false"
      }
      data-recovery-outcome={recoveryOutcome ?? undefined}
    >
      <div className="flex gap-2.5">
        <span className={`mt-0.5 shrink-0 ${icon}`}>
          <StatusIcon kind={kind} />
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-sm leading-6">{body}</p>
        </div>
      </div>
    </div>
  );
}

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
  const [recoveryOutcome, setRecoveryOutcome] =
    useState<RecoverPaymentClientOutcome | null>(null);
  const handledFailedPaymentIds = useRef(new Set<string>());

  function isControlledUnresolvedGuardianDemo(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const value = new URLSearchParams(window.location.search).get(
      "simulate_unresolved_guardian",
    );

    return value === "1" || value === "true";
  }

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

    if (outcome === "hold") {
      return RECOVERY_HOLD_MESSAGE;
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
        body: JSON.stringify(
          recoverPaymentRequestBody(
            razorpayPaymentId,
            isControlledUnresolvedGuardianDemo(),
          ),
        ),
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
    setRecoveryOutcome(result.outcome);

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
    setRecoveryOutcome(null);
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

      setPaymentFailedMessage(null);
      setFailedPaymentId(null);
      setVerificationMessage(messageForVerifiedCheckoutPayment(payload));
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
    <div
      id="checkout"
      className="w-full max-w-[430px] justify-self-end rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] lg:max-w-none"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 1.75A2.75 2.75 0 0 0 5.25 4.5V6H4.5A1.5 1.5 0 0 0 3 7.5v5A1.5 1.5 0 0 0 4.5 14h7A1.5 1.5 0 0 0 13 12.5v-5A1.5 1.5 0 0 0 11.5 6h-.75V4.5A2.75 2.75 0 0 0 8 1.75Zm1.25 4.25h-2.5V4.5a1.25 1.25 0 1 1 2.5 0v1.5Z"
            />
          </svg>
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Secure Checkout</h2>
          <p className="text-[11px] text-slate-500">
            Powered by Razorpay · Protected by Checkout Guardian
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
        <span className="relative h-11 w-11 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
          <Image
            src="/auralis-headphones.png"
            alt=""
            width={88}
            height={88}
            className="h-full w-full object-cover"
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">
            Auralis Premium Headphones
          </p>
          <p className="text-sm font-semibold text-slate-900">₹3,499</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleBuyNow}
        disabled={isStartingCheckout}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0b1220] px-5 text-sm font-semibold tracking-wide text-white outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60"
      >
        {isStartingCheckout ? (
          "Starting checkout…"
        ) : (
          <>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 1.75A2.75 2.75 0 0 0 5.25 4.5V6H4.5A1.5 1.5 0 0 0 3 7.5v5A1.5 1.5 0 0 0 4.5 14h7A1.5 1.5 0 0 0 13 12.5v-5A1.5 1.5 0 0 0 11.5 6h-.75V4.5A2.75 2.75 0 0 0 8 1.75Zm1.25 4.25h-2.5V4.5a1.25 1.25 0 1 1 2.5 0v1.5Z"
              />
            </svg>
            Pay ₹3,499
            <span aria-hidden="true">→</span>
          </>
        )}
      </button>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
        Secure payment powered by
        <img
          src="/razorpay-logo.svg"
          alt="Razorpay"
          width={88}
          height={19}
          className="h-[15px] w-auto"
        />
      </p>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div
          id="protection"
          className="rounded-xl bg-[#eef2ff] px-3 py-2.5 ring-1 ring-[#d9e0f8]"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#6d5efc] text-white">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 1.25 2.5 3.5v4.2c0 3.3 2.2 5.7 5.5 6.95C11.3 13.4 13.5 11 13.5 7.7V3.5L8 1.25Z"
                />
              </svg>
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Checkout protected by Guardian
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-600">
                Payment state is verified before recovery. Uncertain payments are
                held, and merchant policy controls whether recovery may proceed.
              </p>
            </div>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            <li className="flex items-center gap-2 text-[11px] text-slate-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.03 4.22-3.5 4.5-1.12.07-1.75-1.75 1.06-1.06 1.14 1.14 2.99-3.84 1.18.94Z"
                  />
                </svg>
              </span>
              Payment state verified
            </li>
            <li className="flex items-center gap-2 text-[11px] text-slate-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                  <path fill="currentColor" d="M5.25 3h1.5v10h-1.5V3Zm4 0h1.5v10H9.25V3Z" />
                </svg>
              </span>
              Uncertainty held
            </li>
            <li className="flex items-center gap-2 text-[11px] text-slate-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M8 1.75A2.75 2.75 0 0 0 5.25 4.5V6H4.5A1.5 1.5 0 0 0 3 7.5v5A1.5 1.5 0 0 0 4.5 14h7A1.5 1.5 0 0 0 13 12.5v-5A1.5 1.5 0 0 0 11.5 6h-.75V4.5A2.75 2.75 0 0 0 8 1.75Zm1.25 4.25h-2.5V4.5a1.25 1.25 0 1 1 2.5 0v1.5Z"
                  />
                </svg>
              </span>
              Merchant-controlled recovery
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {errorMessage ? (
          <StatusSurface
            kind="failed"
            role="alert"
            title="Payment couldn’t be completed."
            body={errorMessage}
          />
        ) : null}

        {paymentFailedMessage ? (
          <StatusSurface
            kind={
              recoveryOutcome === "hold"
                ? "hold"
                : recoveryOutcome === "started" ||
                    paymentFailedMessage === CHECKING_RECOVERY_MESSAGE
                  ? "recovery"
                  : recoveryOutcome === "unsafe" ||
                      recoveryOutcome === "payment_not_found"
                    ? "hold"
                    : "failed"
            }
            title={
              recoveryOutcome === "hold"
                ? "We’re confirming your previous payment."
                : recoveryOutcome === "started" ||
                    paymentFailedMessage === CHECKING_RECOVERY_MESSAGE
                  ? "Preparing a safe recovery…"
                  : recoveryOutcome === "unsafe" ||
                      recoveryOutcome === "payment_not_found"
                    ? "We’re confirming your previous payment."
                    : "Payment couldn’t be completed."
            }
            body={
              recoveryOutcome === "hold"
                ? "Please don’t pay again yet."
                : paymentFailedMessage
            }
            failedPaymentCaptured={Boolean(failedPaymentId)}
            recoveryOutcome={recoveryOutcome}
          />
        ) : null}

        {isVerifyingPayment ? (
          <StatusSurface
            kind="recovery"
            title="Confirming payment…"
            body="Verifying payment…"
          />
        ) : null}

        {verificationMessage ? (
          <StatusSurface
            kind={
              verificationMessage.toLowerCase().includes("recovered")
                ? "recovered"
                : "success"
            }
            title={
              verificationMessage.toLowerCase().includes("recovered")
                ? "Payment recovered successfully."
                : "Payment verified successfully"
            }
            body={verificationMessage}
          />
        ) : null}
      </div>
    </div>
  );
}
