-- IPD Medicine workflow: link medicine requests & pharmacy bills to an Admission,
-- add nurse daily expenses, and support a CANCELLED request status.

-- AlterEnum: add CANCELLED to QueueStatus (idempotent, PG12+)
ALTER TYPE "QueueStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable: PharmacyQueue.admissionId
ALTER TABLE "PharmacyQueue" ADD COLUMN IF NOT EXISTS "admissionId" UUID;
CREATE INDEX IF NOT EXISTS "PharmacyQueue_admissionId_sentAt_idx" ON "PharmacyQueue"("admissionId", "sentAt");

-- AlterTable: PharmacyBill.admissionId
ALTER TABLE "PharmacyBill" ADD COLUMN IF NOT EXISTS "admissionId" UUID;
CREATE INDEX IF NOT EXISTS "PharmacyBill_admissionId_idx" ON "PharmacyBill"("admissionId");

-- CreateTable: DailyExpense
CREATE TABLE IF NOT EXISTS "DailyExpense" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "nurseId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DailyExpense_admissionId_createdAt_idx" ON "DailyExpense"("admissionId", "createdAt");
CREATE INDEX IF NOT EXISTS "DailyExpense_nurseId_createdAt_idx" ON "DailyExpense"("nurseId", "createdAt");

-- Foreign keys (guarded)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyQueue_admissionId_fkey') THEN
    ALTER TABLE "PharmacyQueue"
      ADD CONSTRAINT "PharmacyQueue_admissionId_fkey"
      FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyBill_admissionId_fkey') THEN
    ALTER TABLE "PharmacyBill"
      ADD CONSTRAINT "PharmacyBill_admissionId_fkey"
      FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyExpense_admissionId_fkey') THEN
    ALTER TABLE "DailyExpense"
      ADD CONSTRAINT "DailyExpense_admissionId_fkey"
      FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyExpense_nurseId_fkey') THEN
    ALTER TABLE "DailyExpense"
      ADD CONSTRAINT "DailyExpense_nurseId_fkey"
      FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
