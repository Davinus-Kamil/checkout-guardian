import { randomUUID } from "crypto";
import { getRazorpayClient } from "@/lib/razorpay/client";

const ORDER_AMOUNT_PAISE = 349900;
const CURRENCY = "INR";

export const runtime = "nodejs";

export async function POST() {
  try {
    const razorpay = getRazorpayClient();
    const receipt = `rcpt_${randomUUID().replaceAll("-", "").slice(0, 32)}`;

    const order = await razorpay.orders.create({
      amount: ORDER_AMOUNT_PAISE,
      currency: CURRENCY,
      receipt,
    });

    return Response.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Razorpay order";
    const isConfigError = message.includes("Missing Razorpay credentials");

    return Response.json(
      {
        error: isConfigError ? message : "Failed to create Razorpay order",
      },
      { status: 500 },
    );
  }
}
