export type RecoveryDecisionReceiptInput = {
  decision: {
    id: string;
    recoverySessionId: string;
    paymentId: string;
    failureCategory: string | null;
    paymentState: string;
    proposedAction: string;
    proposalReason: string | null;
    policyResult: string | null;
    policyReason: string | null;
    executedAction: string | null;
    outcome: string | null;
    recoveredAmount: number | null;
    createdAt: Date;
  };
  session: {
    id: string;
    status: string;
    attemptCount: number;
    originalPaymentId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  order: {
    id: string;
    amount: number;
    currency: string;
    razorpayOrderId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  originalPayment: {
    id: string;
    razorpayPaymentId: string;
    method: string | null;
    gatewayStatus: string;
    guardianState: string;
    failureCategory: string | null;
    errorCode: string | null;
    errorReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  recoveredPayment: {
    id: string;
    razorpayPaymentId: string;
    method: string | null;
    gatewayStatus: string;
    guardianState: string;
    failureCategory: string | null;
    errorCode: string | null;
    errorReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

export type RecoveryDecisionReceipt = {
  decision: RecoveryDecisionReceiptInput["decision"];
  session: RecoveryDecisionReceiptInput["session"];
  order: RecoveryDecisionReceiptInput["order"];
  payments: {
    original: RecoveryDecisionReceiptInput["originalPayment"];
    recovered: RecoveryDecisionReceiptInput["recoveredPayment"];
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
      recovered: input.recoveredPayment
        ? { ...input.recoveredPayment }
        : null,
    },
  };
}