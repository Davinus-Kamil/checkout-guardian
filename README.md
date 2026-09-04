# Checkout Guardian

**Payment failed. Checkout didn’t.**

Checkout Guardian is a state-aware, merchant-governed autonomous revenue-recovery agent that verifies payment truth before recovery, lets AI recommend bounded recovery actions, applies merchant policy before execution, holds uncertain payments, stops unsafe or unnecessary recovery, and proves the resulting financial outcome.

**Razorpay establishes payment truth. AI recommends. Merchant policy authorizes.**

**Observe → Verify → Diagnose → Recommend → Gate → Recover → Audit**

**Verify → Decide → Govern → Recover → Prove**

---

## The problem

A payment marked as failed does not automatically mean that another payment attempt is safe.

A transaction may be genuinely failed and recoverable, uncertain or awaiting sufficient payment truth, already resolved, already recovered, or beyond the merchant’s permitted recovery limit.

Blindly treating every failure as “retry” can create unnecessary payment attempts, poor customer experience, operational confusion, and potential duplicate-payment risk.

> The hard part isn’t retrying a payment. It’s knowing when another payment attempt is actually safe.

Razorpay already provides payment and retry infrastructure. Checkout Guardian does not invent retry. It is the governance layer around authoritative payment truth: verify first, then decide whether recovery is allowed.

---

## Why this problem matters to me

During a recent UPI payment, the payment appeared as failed in Google Pay. I later received an automated verification call regarding the transaction. Because I believed the payment had already failed, I misunderstood the verification and indicated that I had not made the payment. My UPI access was subsequently blocked, and restoring it required visiting my bank in person and submitting a written request.

That experience showed me how consequential confusion around payment state can become. A “payment failed” message is not always the end of the story. Systems should establish payment truth before deciding what financial action should happen next.

Checkout Guardian would not have prevented that incident. The principle it encodes is simpler:

**Never make a payment problem worse.**

---

## What Checkout Guardian does

**Recover what is safe. Hold what is uncertain. Stop what should not continue.**

### RECOVER

The payment is authoritatively confirmed failed, recovery is eligible, and merchant policy permits another attempt.

### HOLD / ESCALATE

Payment truth is insufficient or recovery is unsafe. Guardian does not open another checkout until the state is safe enough.

### STOP

The payment is already resolved or recovered, merchant limits have been reached, or policy otherwise blocks recovery.

---

## How it works

```
Razorpay
  → Server-side verification
  → Guardian failure diagnosis
  → Gemini bounded recommendation
  → Merchant policy gate
  → Authorized recovery
  → Persistent decision + audit evidence
```

| Actor | Responsibility |
| --- | --- |
| **Razorpay** | Authoritative payment truth, payment status, server verification, signed payment webhooks |
| **Guardian** | State normalization, failure classification, recovery eligibility, recovery orchestration, persistent decisions, recovery sessions, financial outcome accounting |
| **Gemini** | Recommends a bounded recovery action and contextual reasoning. Does **not** determine whether money moved. Does **not** execute Razorpay actions |
| **Merchant policy** | Authorizes or blocks the recommendation. Sets recovery boundaries such as maximum recovery attempts. Cannot be bypassed by AI |

**Payment truth is deterministic. AI reasoning is advisory. Financial authorization remains policy-controlled.**

Gemini is consulted only after Guardian has a confirmed failed state. It may recommend `REOPEN_CHECKOUT` or `NO_RECOVERY`. Merchant policy still decides whether recovery starts.

---

## Customer experience — Auralis storefront

The demo merchant is **Auralis**.

| | |
| --- | --- |
| Product | Auralis Premium Headphones |
| Price | **₹3,499** |

Demonstrated flow:

1. Customer starts payment
2. Razorpay Checkout opens
3. A genuine Razorpay Test Mode failure occurs
4. Guardian verifies the payment with Razorpay
5. Guardian evaluates recovery eligibility
6. Gemini recommends a bounded action
7. Merchant policy authorizes it
8. Razorpay Checkout is reopened
9. Customer completes the recovery payment
10. The captured payment is verified
11. The recovery session completes
12. Recovered revenue is persisted
13. The customer sees the successful recovered-payment state

When payment truth is insufficient, the storefront holds instead of retrying:

> We’re confirming your previous payment. Please don’t pay again yet.

Guardian does not turn uncertainty into another payment attempt.

---

## Merchant dashboard — A to Z

The dashboard turns individual failed checkouts into a **revenue-recovery portfolio**.

| Metric | Meaning |
| --- | --- |
| **Revenue at Risk** | Value of cases currently needing recovery or hold |
| **Recoverable Value** | Value Guardian currently treats as eligible for safe recovery |
| **Revenue Recovered** | Persisted financial value from completed recovered outcomes |
| **Held / Escalated** | Cases where uncertainty or safety boundaries prevent another attempt |
| **Recovery Stopped** | Cases where Guardian blocks further recovery |

### Razorpay Test Mode proof

> **₹6,998 recovered** across **two** persisted completed recovery cases.

This is Razorpay **Test Mode** value, not production revenue. It is two recovered Auralis checkouts (₹3,499 × 2).

### Recovery portfolio table

Each row shows case status (recover / hold / stop), payment and failure context, policy result and reason, recovered amount when applicable, and a link to the Decision Receipt.

### Recovery policy

The merchant defines recovery boundaries. **Maximum recovery attempts** is a hard gate. AI cannot override merchant policy.

### Decision Receipts

A Decision Receipt is a **read-only** audit view reconstructed from persisted state. It is not a separate database table.

A successful receipt can connect original payment state, Guardian diagnosis, AI recommendation and reasoning, merchant policy decision, authorized or executed action, recovery session, final payment state, and recovered amount.

**Autonomous financial decisions should leave evidence.**

---

## Real Razorpay Test Mode proof

Checkout Guardian has been demonstrated with Razorpay Test Mode:

- real successful payment flow
- real Razorpay Test Mode failed payment
- Razorpay failed payment status
- server-side Fetch Payment verification
- `payment.failed` webhook
- `payment.captured` webhook
- HMAC webhook signature verification
- recovery authorization
- reopening Razorpay Checkout
- successful recovered payment
- persisted recovered financial outcome

These flows produced the persisted recovery outcomes summarized in the merchant portfolio above.

---

## Controlled demo disclosure

Razorpay Test Mode does not provide a deterministic way to reproduce every real-world ambiguous or late-confirmation payment condition.

The Guardian **UNRESOLVED / HOLD** boundary can therefore be demonstrated through a **controlled branch after real payment verification**.

**REAL RAZORPAY DATA + CONTROLLED GUARDIAN SIMULATION**

UNRESOLVED is a **Guardian** state. It is not a native Razorpay status.

Controlled boundary cases on the dashboard are labeled, show Guardian’s decision boundary, and **do not contribute to recovered-revenue metrics**.

---

## Safety / governance

| Concern | Guardian boundary |
| --- | --- |
| Who determines whether money moved? | Razorpay / server verification |
| Can Gemini mark a payment successful or failed? | No |
| Can Gemini execute Razorpay actions directly? | No |
| Can uncertainty silently become failure? | No |
| Can AI bypass merchant recovery policy? | No |
| Can HOLD open another checkout? | No |
| Are recovery attempts bounded? | Yes |
| Are financial outcomes persisted? | Yes |
| Are controlled demo cases counted as recovered revenue? | No |

**Uncertainty reduces autonomy.**

Checkout Guardian reduces unsafe retries. It does not claim that duplicate charges are impossible.

---

## Tech stack

- Next.js 16.3.4
- React 19
- TypeScript
- Tailwind CSS
- Razorpay Test Mode (`razorpay` SDK)
- Supabase PostgreSQL
- Prisma 7.10.0
- `@prisma/adapter-pg` and `pg`
- Gemini Developer API

---

## Data / audit model

Seven persisted models:

- Merchant
- MerchantPolicy
- Order
- Payment
- RecoverySession
- PaymentEvent
- Decision

There is **no** `DecisionReceipt` table. Receipts are derived from those records at read time.

---

## Validation

**246 / 246 automated tests passing**
**Production build passing**
**TypeScript / build validation passing**
**Protected application baseline: [`6093778`](https://github.com/Davinus-Kamil/checkout-guardian/commit/6093778)**

Later README commits are documentation-only. They do not change that application baseline.

---

## Demo & Presentation

### 5-Minute Pitch

[Watch the Checkout Guardian demo](https://drive.google.com/file/d/1npbX_WnzcKd6cQKdLDAx2lPJiS5Mf3R9/view?usp=drive_link)

### Presentation

[Open the Checkout Guardian pitch storyboard](docs/checkout-guardian-pitch.html)

This is the judge-facing storyboard used for the 5-minute pitch, covering the payment-state problem, real Razorpay recovery, HOLD, STOP, the merchant recovery portfolio, authority boundaries, and Decision Receipts.

---

## Run locally

```bash
git clone https://github.com/Davinus-Kamil/checkout-guardian.git
cd checkout-guardian
npm install
```

Create `.env.local` with the names the app actually reads. **Do not commit this file.** Values are secrets — never put them in git.

| Name | Used for |
| --- | --- |
| `DATABASE_URL` | Prisma / `pg` runtime connection |
| `DIRECT_URL` | Prisma CLI / `prisma7.config.ts` |
| `RAZORPAY_KEY_ID` | Razorpay server SDK |
| `RAZORPAY_KEY_SECRET` | Razorpay server SDK and checkout signature verification |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Checkout on the storefront |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC verification |
| `GEMINI_API_KEY` | Advisory recovery recommendation |
| `GEMINI_MODEL` | Optional Gemini model override |

You need a PostgreSQL database reachable through those URLs, plus Razorpay Test Mode keys.

```bash
npm run dev
```

Storefront: [http://localhost:3000](http://localhost:3000)
Merchant dashboard: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

```bash
npm test
npm run build
```

`npm start` serves the production build. `npm run lint` runs ESLint.

---

Checkout Guardian treats recovery as a governed financial decision rather than an automatic retry.

**Verify what happened. Recover what is safe. Hold what is uncertain. Stop when policy says stop. Prove the outcome.**

# Payment failed. Checkout didn’t.
