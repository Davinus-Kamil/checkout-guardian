import {
  parseRecoveryDecisionEngineOutput,
  type RecoveryDecisionEngineRecommendedAction,
} from "./parse-recovery-decision-engine-output.ts";

export const RECOVERY_DECISION_ENGINE_TIMEOUT_MS = 10000;
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const GEMINI_GENERATE_CONTENT_ORIGIN =
  "https://generativelanguage.googleapis.com";

export type RecoveryDecisionEngineInput = {
  guardianState: "FAILED";
  failureCategory: "GENERIC_PAYMENT_FAILED";
  paymentMethod: string | null;
  errorCode: string | null;
  errorReason: string | null;
  candidateAction: "REOPEN_CHECKOUT";
};

export type RecoveryDecisionEngineResult =
  | {
      available: true;
      recommendedAction: RecoveryDecisionEngineRecommendedAction;
      reason: string;
    }
  | { available: false };

export type ConsultRecoveryDecisionEngineDeps = {
  fetch?: typeof fetch;
  env?: {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
  };
};

type AdvisoryUnavailableReason =
  | "INVALID_INPUT"
  | "MISSING_KEY"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "RESPONSE_JSON_ERROR"
  | "EMPTY_CANDIDATE"
  | "MODEL_JSON_ERROR"
  | "PARSE_REJECTED"
  | "INTERNAL_ERROR";

const SYSTEM_PROMPT = [
  "You are an advisory recovery reasoning layer only.",
  "The supplied payment state and failure category are authoritative deterministic facts.",
  "Do not reinterpret whether payment succeeded or failed.",
  "You cannot authorize or execute recovery.",
  "You cannot change guardianState, failureCategory, policyResult, or determine payment truth.",
  "Recommend only REOPEN_CHECKOUT or NO_RECOVERY.",
  "Return only the required structured JSON.",
  "reason must be a short non-empty explanation of at most 280 characters.",
].join(" ");

function unavailable(): RecoveryDecisionEngineResult {
  return { available: false };
}

function logAdvisoryUnavailable(
  reason: AdvisoryUnavailableReason,
  extras?: {
    httpStatus?: number;
    model?: string;
  },
): void {
  const diagnostic: {
    reason: AdvisoryUnavailableReason;
    httpStatus?: number;
    model?: string;
  } = { reason };

  if (typeof extras?.httpStatus === "number") {
    diagnostic.httpStatus = extras.httpStatus;
  }

  if (typeof extras?.model === "string") {
    diagnostic.model = extras.model;
  }

  console.error("M17_ADVISORY_UNAVAILABLE", diagnostic);
}

function geminiGenerateContentUrl(model: string): string {
  return `${GEMINI_GENERATE_CONTENT_ORIGIN}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

function readGeminiText(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = record.candidates;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const first = candidates[0];

  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return null;
  }

  const content = (first as Record<string, unknown>).content;

  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }

  const parts = (content as Record<string, unknown>).parts;

  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }

  const part = parts[0];

  if (!part || typeof part !== "object" || Array.isArray(part)) {
    return null;
  }

  return (part as Record<string, unknown>).text;
}

function parseGeminiText(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name: unknown }).name === "AbortError",
  );
}

export async function consultRecoveryDecisionEngine(
  input: RecoveryDecisionEngineInput,
  deps: ConsultRecoveryDecisionEngineDeps = {},
): Promise<RecoveryDecisionEngineResult> {
  try {
    if (
      input.guardianState !== "FAILED" ||
      input.failureCategory !== "GENERIC_PAYMENT_FAILED" ||
      input.candidateAction !== "REOPEN_CHECKOUT"
    ) {
      logAdvisoryUnavailable("INVALID_INPUT");
      return unavailable();
    }

    const env = deps.env ?? process.env;
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      logAdvisoryUnavailable("MISSING_KEY");
      return unavailable();
    }

    const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const fetchImpl = deps.fetch ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      RECOVERY_DECISION_ENGINE_TIMEOUT_MS,
    );

    let response: Response;

    try {
      response = await fetchImpl(geminiGenerateContentUrl(model), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify({
                    guardianState: input.guardianState,
                    failureCategory: input.failureCategory,
                    paymentMethod: input.paymentMethod,
                    errorCode: input.errorCode,
                    errorReason: input.errorReason,
                    candidateAction: input.candidateAction,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                recommendedAction: {
                  type: "STRING",
                  enum: ["REOPEN_CHECKOUT", "NO_RECOVERY"],
                },
                reason: { type: "STRING" },
              },
              required: ["recommendedAction", "reason"],
            },
          },
        }),
      });
    } catch (error) {
      logAdvisoryUnavailable(isAbortError(error) ? "TIMEOUT" : "NETWORK_ERROR", {
        model,
      });
      return unavailable();
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logAdvisoryUnavailable("HTTP_ERROR", {
        httpStatus: response.status,
        model,
      });
      return unavailable();
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      logAdvisoryUnavailable("RESPONSE_JSON_ERROR", { model });
      return unavailable();
    }

    const candidateText = readGeminiText(payload);

    if (typeof candidateText !== "string") {
      logAdvisoryUnavailable("EMPTY_CANDIDATE", { model });
      return unavailable();
    }

    const modelJson = parseGeminiText(candidateText);

    if (modelJson === null) {
      logAdvisoryUnavailable("MODEL_JSON_ERROR", { model });
      return unavailable();
    }

    const parsed = parseRecoveryDecisionEngineOutput(modelJson);

    if (!parsed.ok) {
      logAdvisoryUnavailable("PARSE_REJECTED", { model });
      return unavailable();
    }

    return {
      available: true,
      recommendedAction: parsed.recommendedAction,
      reason: parsed.reason,
    };
  } catch {
    logAdvisoryUnavailable("INTERNAL_ERROR");
    return unavailable();
  }
}
