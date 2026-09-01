import {
  getRazorpayWebhookSecret,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay/verify-signature";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  let secret: string;

  try {
    secret = getRazorpayWebhookSecret();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Missing RAZORPAY_WEBHOOK_SECRET.";

    return Response.json({ error: message }, { status: 500 });
  }

  if (
    !signature ||
    !verifyRazorpayWebhookSignature({ rawBody, signature, secret })
  ) {
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  const payload = JSON.parse(rawBody) as unknown;

  console.log("RAZORPAY_WEBHOOK_RECEIVED", JSON.stringify(payload, null, 2));

  return Response.json({ received: true });
}
