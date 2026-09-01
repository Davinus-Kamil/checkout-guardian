import { prisma } from "@/lib/prisma";
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

    if (!verified) {
      return Response.json({ verified: false }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: orderId },
    });

    if (!order) {
      return Response.json(
        {
          verified: false,
          error: "Failed to verify payment",
        },
        { status: 500 },
      );
    }

    await prisma.payment.upsert({
      where: { razorpayPaymentId: paymentId },
      update: {
        guardianState: "SUCCESS",
      },
      create: {
        orderId: order.id,
        razorpayPaymentId: paymentId,
        method: null,
        gatewayStatus: "captured",
        guardianState: "SUCCESS",
        failureCategory: null,
        errorCode: null,
        errorReason: null,
      },
    });

    return Response.json({ verified: true }, { status: 200 });
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
