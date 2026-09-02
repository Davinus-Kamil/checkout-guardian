import {
  parseRecoverPaymentBody,
  recoveryHttpStatus,
  runPaymentRecovery,
} from "@/lib/payments/run-payment-recovery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json().catch(() => null);
    const parsed = parseRecoverPaymentBody(payload);

    if (!parsed.ok) {
      return Response.json(
        { started: false, reason: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const result = await runPaymentRecovery(
      parsed.razorpayPaymentId,
      undefined,
      {
        simulateUnresolvedGuardian: parsed.simulateUnresolvedGuardian,
      },
    );

    return Response.json(result, { status: recoveryHttpStatus(result) });
  } catch {
    console.error("PAYMENT_RECOVER_INTERNAL_ERROR");
    return Response.json(
      { started: false, reason: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
