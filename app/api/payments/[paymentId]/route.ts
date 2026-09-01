import { getRazorpayClient } from "@/lib/razorpay/client";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;

    if (!paymentId) {
      return Response.json({ error: "Missing payment ID" }, { status: 400 });
    }

    const razorpay = getRazorpayClient();
    const payment = await razorpay.payments.fetch(paymentId);

    return Response.json(payment);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch payment";
    const isConfigError = message.includes("Missing Razorpay credentials");

    return Response.json(
      {
        error: isConfigError ? message : "Failed to fetch payment",
      },
      { status: 500 },
    );
  }
}
