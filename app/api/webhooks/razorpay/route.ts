import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getRazorpayWebhookSecret,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay/verify-signature";

export const runtime = "nodejs";

const SUPPORTED_EVENTS = new Set(["payment.failed", "payment.captured"]);
const GUARDIAN_STATE_PLACEHOLDER = "UNSET";
const UNKNOWN_GATEWAY_STATUS = "unknown";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readStringField(value: unknown, key: string) {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const field = record[key];
  return typeof field === "string" && field.trim() ? field : null;
}

function readPaymentEntity(payload: unknown) {
  const webhookPayload = asRecord(asRecord(payload)?.payload);
  const payment = asRecord(webhookPayload?.payment);
  return asRecord(payment?.entity);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  let secret: string;

  try {
    secret = getRazorpayWebhookSecret();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Missing RAZORPAY_WEBHOOK_SECRET.";

    return Response.json({ error: message }, { status: 500 });
  }

  if (
    !signature ||
    !verifyRazorpayWebhookSignature({ rawBody, signature, secret })
  ) {
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json({ error: "Malformed webhook payload" }, { status: 400 });
  }

  const eventType = readStringField(payload, "event");

  if (!eventType || !SUPPORTED_EVENTS.has(eventType)) {
    return Response.json({ received: true });
  }

  const entity = readPaymentEntity(payload);
  const razorpayPaymentId = readStringField(entity, "id");
  const razorpayOrderId = readStringField(entity, "order_id");

  if (!razorpayPaymentId || !razorpayOrderId) {
    return Response.json(
      { error: "Malformed payment webhook event" },
      { status: 400 },
    );
  }

  try {
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
    });

    if (!order) {
      console.log("RAZORPAY_WEBHOOK_SKIPPED_UNKNOWN_ORDER", {
        eventType,
        razorpayPaymentId,
      });
      return Response.json({ received: true });
    }

    const method = readStringField(entity, "method");
    const gatewayStatus = readStringField(entity, "status");
    const errorCode = readStringField(entity, "error_code");
    const errorReason = readStringField(entity, "error_reason");

    const paymentUpdate: {
      method?: string;
      gatewayStatus?: string;
      errorCode?: string;
      errorReason?: string;
    } = {};

    if (method) {
      paymentUpdate.method = method;
    }
    if (gatewayStatus) {
      paymentUpdate.gatewayStatus = gatewayStatus;
    }
    if (errorCode) {
      paymentUpdate.errorCode = errorCode;
    }
    if (errorReason) {
      paymentUpdate.errorReason = errorReason;
    }

    const persistResult = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { razorpayPaymentId },
        create: {
          orderId: order.id,
          razorpayPaymentId,
          method,
          gatewayStatus: gatewayStatus ?? UNKNOWN_GATEWAY_STATUS,
          guardianState: GUARDIAN_STATE_PLACEHOLDER,
          failureCategory: null,
          errorCode,
          errorReason,
        },
        update: paymentUpdate,
      });

      const createdEvents = await tx.paymentEvent.createMany({
        data: [
          {
            paymentId: payment.id,
            eventType,
            payload: payload as Prisma.InputJsonValue,
          },
        ],
        skipDuplicates: true,
      });

      return { payment, duplicate: createdEvents.count === 0 };
    });

    console.log(
      persistResult.duplicate
        ? "RAZORPAY_WEBHOOK_DUPLICATE"
        : "RAZORPAY_WEBHOOK_PERSISTED",
      {
        eventType,
        razorpayPaymentId,
        paymentId: persistResult.payment.id,
      },
    );

    return Response.json({ received: true });
  } catch {
    return Response.json(
      { error: "Failed to persist webhook event" },
      { status: 500 },
    );
  }
}
