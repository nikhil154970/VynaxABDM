-- AlterEnum
ALTER TYPE "PharmacyPaymentMode" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "PharmacyBill" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PharmacyPayment" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "patientId" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMode" "PharmacyPaymentMode" NOT NULL,
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PharmacyPayment_billId_idx" ON "PharmacyPayment"("billId");
CREATE INDEX IF NOT EXISTS "PharmacyPayment_patientId_idx" ON "PharmacyPayment"("patientId");
CREATE INDEX IF NOT EXISTS "PharmacyPayment_createdAt_idx" ON "PharmacyPayment"("createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PharmacyPayment" ADD CONSTRAINT "PharmacyPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PharmacyBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PharmacyPayment" ADD CONSTRAINT "PharmacyPayment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
