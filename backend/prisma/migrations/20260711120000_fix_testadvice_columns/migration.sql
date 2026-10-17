-- Corrective migration: the TestAdvice ADD COLUMN portion of 20260703092233_y
-- was recorded as applied but never actually executed on some databases.
-- This idempotently adds the missing columns, indexes and foreign keys.

-- AlterTable
ALTER TABLE "TestAdvice" ADD COLUMN IF NOT EXISTS "admissionId" UUID;
ALTER TABLE "TestAdvice" ADD COLUMN IF NOT EXISTS "clinicalNote" TEXT;
ALTER TABLE "TestAdvice" ADD COLUMN IF NOT EXISTS "requestedByUserId" UUID;
ALTER TABLE "TestAdvice" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestAdvice_admissionId_createdAt_idx" ON "TestAdvice"("admissionId", "createdAt");
CREATE INDEX IF NOT EXISTS "TestAdvice_source_status_createdAt_idx" ON "TestAdvice"("source", "status", "createdAt");

-- AddForeignKey (guarded so re-runs are safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TestAdvice_admissionId_fkey'
  ) THEN
    ALTER TABLE "TestAdvice"
      ADD CONSTRAINT "TestAdvice_admissionId_fkey"
      FOREIGN KEY ("admissionId") REFERENCES "Admission"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TestAdvice_requestedByUserId_fkey'
  ) THEN
    ALTER TABLE "TestAdvice"
      ADD CONSTRAINT "TestAdvice_requestedByUserId_fkey"
      FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
