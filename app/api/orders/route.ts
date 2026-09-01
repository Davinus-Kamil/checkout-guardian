import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/razorpay/client";

const ORDER_AMOUNT_PAISE = 349900;
const CURRENCY = "INR";
const DEMO_MERCHANT_ID = "demo_checkout_guardian_merchant";
const DEMO_MERCHANT_NAME = "Checkout Guardian Demo Merchant";

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

    await prisma.merchant.upsert({
      where: { id: DEMO_MERCHANT_ID },
      update: {},
      create: {
        id: DEMO_MERCHANT_ID,
        name: DEMO_MERCHANT_NAME,
      },
    });

    await prisma.order.upsert({
      where: { razorpayOrderId: order.id },
      update: {},
      create: {
        merchantId: DEMO_MERCHANT_ID,
        razorpayOrderId: order.id,
        amount:
          typeof order.amount === "number"
            ? order.amount
            : Number(order.amount),
        currency: String(order.currency),
        status: String(order.status),
      },
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
