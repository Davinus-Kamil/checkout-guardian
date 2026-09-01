-- DropIndex
DROP INDEX "RecoverySession_originalPaymentId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "RecoverySession_originalPaymentId_key" ON "RecoverySession"("originalPaymentId");
