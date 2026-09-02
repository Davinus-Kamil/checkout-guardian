import { confirmCheckoutPayment } from "@/lib/payments/confirm-checkout-payment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json().catch(() => null);
    const result = await confirmCheckoutPayment(payload);

    if (result.verified) {
      return Response.json({ verified: true }, { status: 200 });
    }

    return Response.json(
      result.error
        ? { verified: false, error: result.error }
        : { verified: false },
      { status: result.httpStatus },
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
