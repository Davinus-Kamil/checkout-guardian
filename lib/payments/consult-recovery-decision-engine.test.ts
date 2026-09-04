import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  consultRecoveryDecisionEngine,
  DEFAULT_GEMINI_MODEL,
  GEMINI_GENERATE_CONTENT_ORIGIN,
  type RecoveryDecisionEngineInput,
} from "./consult-recovery-decision-engine.ts";

const FAKE_GEMINI_API_KEY = "gemini_test_key_not_real";

const input: RecoveryDecisionEngineInput = {
  guardianState: "FAILED",
  failureCategory: "GENERIC_PAYMENT_FAILED",
  paymentMethod: "card",
  errorCode: "BAD_REQUEST_ERROR",
  errorReason: "payment_failed",
  candidateAction: "REOPEN_CHECKOUT",
};

function geminiBody(content: unknown) {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text:
                typeof content === "string" ? content : JSON.stringify(content),
            },
          ],
        },
      },
    ],
  };
}

test("missing GEMINI_API_KEY is advisory-unavailable and does not fetch", async (t) => {
  const error = mock.method(console, "error", () => {});
  t.after(() => error.mock.restore());
  let fetched = 0;
  const result = await consultRecoveryDecisionEngine(input, {
    env: {},
    fetch: async () => {
      fetched += 1;
      throw new Error("should not fetch");
    },
  });

  assert.deepEqual(result, { available: false });
  assert.equal(fetched, 0);
});

test("Gemini non-2xx is advisory-unavailable", async (t) => {
  const error = mock.method(console, "error", () => {});
  t.after(() => error.mock.restore());

  const result = await consultRecoveryDecisionEngine(input, {
    env: { GEMINI_API_KEY: FAKE_GEMINI_API_KEY },
    fetch: async () => new Response("nope", { status: 500 }),
  });

  assert.deepEqual(result, { available: false });
  assert.deepEqual(error.mock.calls[0]?.arguments, [
    "M17_ADVISORY_UNAVAILABLE",
    {
      reason: "HTTP_ERROR",
      httpStatus: 500,
      model: DEFAULT_GEMINI_MODEL,
    },
  ]);
  assert.equal(
    JSON.stringify(error.mock.calls).includes(FAKE_GEMINI_API_KEY),
    false,
  );
});

test("fetch throw is advisory-unavailable", async (t) => {
  const error = mock.method(console, "error", () => {});
  t.after(() => error.mock.restore());
  const result = await consultRecoveryDecisionEngine(input, {
    env: { GEMINI_API_KEY: FAKE_GEMINI_API_KEY },
    fetch: async () => {
      throw new Error("network down");
    },
  });

  assert.deepEqual(result, { available: false });
});

test("malformed Gemini response is advisory-unavailable", async (t) => {
  const error = mock.method(console, "error", () => {});
  t.after(() => error.mock.restore());

  const result = await consultRecoveryDecisionEngine(input, {
    env: { GEMINI_API_KEY: FAKE_GEMINI_API_KEY },
    fetch: async () =>
      new Response(JSON.stringify(geminiBody("not-json")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });

  assert.deepEqual(result, { available: false });
  assert.deepEqual(error.mock.calls[0]?.arguments, [
    "M17_ADVISORY_UNAVAILABLE",
    {
      reason: "MODEL_JSON_ERROR",
      model: DEFAULT_GEMINI_MODEL,
    },
  ]);
  assert.equal(
    JSON.stringify(error.mock.calls).includes(FAKE_GEMINI_API_KEY),
    false,
  );
});

test("valid Gemini structured response is advisory-available", async (t) => {
  const error = mock.method(console, "error", () => {});
  t.after(() => error.mock.restore());

  const result = await consultRecoveryDecisionEngine(input, {
    env: {
      GEMINI_API_KEY: FAKE_GEMINI_API_KEY,
      GEMINI_MODEL: DEFAULT_GEMINI_MODEL,
    },
    fetch: async () =>
      new Response(
        JSON.stringify(
          geminiBody({
            recommendedAction: "REOPEN_CHECKOUT",
            reason: "Confirmed card failure; reopen checkout.",
          }),
        ),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  });

  assert.deepEqual(result, {
    available: true,
    recommendedAction: "REOPEN_CHECKOUT",
    reason: "Confirmed card failure; reopen checkout.",
  });
  assert.equal(
    error.mock.calls.some(
      (call) => call.arguments[0] === "M17_ADVISORY_UNAVAILABLE",
    ),
    false,
  );
});

test("consult request contains only bounded advisory context", async (t) => {
  const error = mock.method(console, "error", () => {});
  t.after(() => error.mock.restore());
  let url = "";
  let body = "";
  const headers: Record<string, string> = {};

  await consultRecoveryDecisionEngine(input, {
    env: { GEMINI_API_KEY: FAKE_GEMINI_API_KEY },
    fetch: async (requestUrl, init) => {
      url = String(requestUrl);
      body = String(init?.body ?? "");
      const incoming = new Headers(init?.headers);
      incoming.forEach((value, key) => {
        headers[key] = value;
      });
      return new Response(JSON.stringify(geminiBody({})), { status: 200 });
    },
  });

  assert.equal(url.startsWith(GEMINI_GENERATE_CONTENT_ORIGIN), true);
  assert.equal(url.includes(DEFAULT_GEMINI_MODEL), true);
  assert.equal(url.includes(":generateContent"), true);
  assert.equal(body.includes("GENERIC_PAYMENT_FAILED"), true);
  assert.equal(body.includes("REOPEN_CHECKOUT"), true);
  assert.equal(body.includes("BAD_REQUEST_ERROR"), true);
  assert.equal(body.includes("payment_failed"), true);
  assert.equal(headers["x-goog-api-key"], FAKE_GEMINI_API_KEY);
});

test("consult request does not contain policy, Razorpay secrets, or database credentials", async (t) => {
  const error = mock.method(console, "error", () => {});
  t.after(() => error.mock.restore());
  let url = "";
  let body = "";

  await consultRecoveryDecisionEngine(input, {
    env: { GEMINI_API_KEY: FAKE_GEMINI_API_KEY },
    fetch: async (requestUrl, init) => {
      url = String(requestUrl);
      body = String(init?.body ?? "");
      return new Response(JSON.stringify(geminiBody({})), { status: 200 });
    },
  });

  assert.equal(body.includes(FAKE_GEMINI_API_KEY), false);
  assert.equal(url.includes(FAKE_GEMINI_API_KEY), false);
  assert.equal(body.includes("requireConfirmedFailure"), false);
  assert.equal(body.includes("attemptCount"), false);
  assert.equal(body.includes("RAZORPAY"), false);
  assert.equal(body.includes("DATABASE_URL"), false);
  assert.equal(body.includes("isCaptured"), false);
  assert.equal(body.includes("recoveredAmount"), false);
  assert.equal(url.includes("api.openai.com"), false);
  assert.equal(body.includes("OPENAI"), false);
});
