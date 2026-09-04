import { parseMerchantPolicyUpdate } from "@/lib/payments/parse-merchant-policy-update";
import { updateMerchantPolicy } from "@/lib/payments/update-merchant-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json().catch(() => null);
    const parsed = parseMerchantPolicyUpdate(payload);

    if (!parsed.ok) {
      return Response.json(
        { ok: false, reason: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const result = await updateMerchantPolicy(parsed.update);

    if (!result.ok) {
      return Response.json(
        { ok: false, reason: result.reason },
        { status: result.reason === "POLICY_NOT_FOUND" ? 404 : 400 },
      );
    }

    return Response.json({
      ok: true,
      policy: {
        requireConfirmedFailure: result.policy.requireConfirmedFailure,
        maxRecoveryAttempts: result.policy.maxRecoveryAttempts,
        allowAlternativeMethod: result.policy.allowAlternativeMethod,
        unknownStateAction: result.policy.unknownStateAction,
        riskFailureAction: result.policy.riskFailureAction,
      },
    });
  } catch {
    console.error("MERCHANT_POLICY_UPDATE_INTERNAL_ERROR");
    return Response.json(
      { ok: false, reason: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
