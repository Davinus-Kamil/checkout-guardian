import { createHmac, timingSafeEqual } from "crypto";
import { getRazorpayKeySecret } from "@/lib/razorpay/client";

function signaturesMatch(expectedHex: string, actualHex: string) {
  const expectedBuffer = Buffer.from(expectedHex, "utf8");
  const actualBuffer = Buffer.from(actualHex, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function getRazorpayWebhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing RAZORPAY_WEBHOOK_SECRET.");
  }

  return secret;
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = getRazorpayKeySecret();
  const expected = createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  return signaturesMatch(expected, input.signature);
}

export function verifyRazorpayWebhookSignature(input: {
  rawBody: string;
  signature: string;
  secret: string;
}) {
  const expected = createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest("hex");

  return signaturesMatch(expected, input.signature);
}
