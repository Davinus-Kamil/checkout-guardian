export type RecoveryDecisionReceiptInput = {
  decision: {
    paymentState: string;
    failureCategory: string | null;
    proposedAction: string;
    policyResult: string | null;
    policyReason: string | null;
    executedAction: string | null;
    outcome: string | null;
    recoveredAmount: number | null;
  };
  session: {
    status: string;
    attemptCount: number;
    originalPaymentId: string;
  };
  order: {
    amount: number;
    currency: string;
    razorpayOrderId: string;
  };
  originalPayment: {
    gatewayStatus: string;
    guardianState: string;
  };
  successfulPayment: {
    gatewayStatus: string;
    guardianState: string;
  };
};

export type RecoveryDecisionReceipt = {
  decision: RecoveryDecisionReceiptInput["decision"];
  session: RecoveryDecisionReceiptInput["session"];
  order: RecoveryDecisionReceiptInput["order"];
  payments: {
    original: RecoveryDecisionReceiptInput["originalPayment"];
    recovered: RecoveryDecisionReceiptInput["successfulPayment"];
  };
};

export function deriveRecoveryDecisionReceipt(
  input: RecoveryDecisionReceiptInput,
): RecoveryDecisionReceipt {
  return {
    decision: { ...input.decision },
    session: { ...input.session },
    order: { ...input.order },
    payments: {
      original: { ...input.originalPayment },
      recovered: { ...input.successfulPayment },
    },
  };
}
