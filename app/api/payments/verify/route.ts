import { verifyRazorpayPaymentSignature } from "@/lib/razorpay/verify-signature";

export const runtime = "nodejs";

function readStringField(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json().catch(() => null);

    const paymentId = readStringField(payload, "razorpay_payment_id");
    const orderId = readStringField(payload, "razorpay_order_id");
    const signature = readStringField(payload, "razorpay_signature");

    if (!paymentId || !orderId || !signature) {
      return Response.json(
        {
          verified: false,
          error:
            "Missing razorpay_payment_id, razorpay_order_id, or razorpay_signature.",
        },
        { status: 400 },
      );
    }

    const verified = verifyRazorpayPaymentSignature({
      orderId,
      paymentId,
      signature,
    });

    return Response.json(
      { verified },
      { status: verified ? 200 : 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify payment";
    const isConfigError = message.includes("Missing Razorpay credentials");

    return Response.json(
      {
        verified: false,
        error: isConfigError ? message : "Failed to verify payment",
      },
      { status: 500 },
    );
  }
}
