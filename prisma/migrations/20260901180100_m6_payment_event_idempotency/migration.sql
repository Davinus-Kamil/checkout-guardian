-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_paymentId_eventType_key" ON "PaymentEvent"("paymentId", "eventType");
