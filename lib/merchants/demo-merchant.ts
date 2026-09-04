export const DEMO_MERCHANT_ID = "demo_checkout_guardian_merchant";
export const DEMO_MERCHANT_NAME = "Checkout Guardian Demo Merchant";

export const DEMO_MERCHANT_POLICY_DEFAULTS = {
  requireConfirmedFailure: true,
  maxRecoveryAttempts: 1,
  allowAlternativeMethod: true,
  unknownStateAction: "BLOCK",
  riskFailureAction: "BLOCK",
} as const;
