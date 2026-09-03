import {
  loadRecoveryDecisionReceipt,
  mapRecoveryDecisionReceiptHttp,
} from "@/lib/payments/load-recovery-decision-receipt";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ decisionId: string }> },
) {
  try {
    const { decisionId } = await params;
    const result = await loadRecoveryDecisionReceipt(decisionId);
    const mapped = mapRecoveryDecisionReceiptHttp(result);

    return Response.json(mapped.body, { status: mapped.status });
  } catch {
    console.error("DECISION_RECEIPT_INTERNAL_ERROR");
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
