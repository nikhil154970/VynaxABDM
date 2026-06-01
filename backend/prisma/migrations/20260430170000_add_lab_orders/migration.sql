-- Lab test catalog
CREATE TABLE IF NOT EXISTS "LabTestCatalog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "sampleType" TEXT,
  "unit" TEXT,
  "referenceRange" TEXT,
  "price" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabTestCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LabTestCatalog_code_key" ON "LabTestCatalog"("code");
CREATE INDEX IF NOT EXISTS "LabTestCatalog_category_idx" ON "LabTestCatalog"("category");
CREATE INDEX IF NOT EXISTS "LabTestCatalog_isActive_idx" ON "LabTestCatalog"("isActive");

-- Enums (Postgres)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LabOrderStatus') THEN
    CREATE TYPE "LabOrderStatus" AS ENUM ('PENDING_BILLING', 'BILLED', 'COLLECTED', 'COMPLETED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LabReportStatus') THEN
    CREATE TYPE "LabReportStatus" AS ENUM ('PENDING', 'COMPLETED', 'VERIFIED');
  END IF;
END $$;

-- Lab order
CREATE TABLE IF NOT EXISTS "LabOrder" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderNumber" TEXT NOT NULL,
  "patientId" UUID NOT NULL,
  "doctorId" UUID NOT NULL,
  "appointmentId" UUID,
  "consultationId" UUID,
  "status" "LabOrderStatus" NOT NULL DEFAULT 'PENDING_BILLING',
  "reportStatus" "LabReportStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "billedAt" TIMESTAMP(3),
  "billedByUserId" UUID,
  "billId" UUID,
  CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LabOrder_orderNumber_key" ON "LabOrder"("orderNumber");
CREATE INDEX IF NOT EXISTS "LabOrder_patientId_createdAt_idx" ON "LabOrder"("patientId", "createdAt");
CREATE INDEX IF NOT EXISTS "LabOrder_doctorId_createdAt_idx" ON "LabOrder"("doctorId", "createdAt");
CREATE INDEX IF NOT EXISTS "LabOrder_status_createdAt_idx" ON "LabOrder"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "LabOrder_billId_idx" ON "LabOrder"("billId");

ALTER TABLE "LabOrder"
  ALTER COLUMN "orderNumber" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrder_patientId_fkey') THEN
    ALTER TABLE "LabOrder"
      ADD CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrder_doctorId_fkey') THEN
    ALTER TABLE "LabOrder"
      ADD CONSTRAINT "LabOrder_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrder_appointmentId_fkey') THEN
    ALTER TABLE "LabOrder"
      ADD CONSTRAINT "LabOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrder_consultationId_fkey') THEN
    ALTER TABLE "LabOrder"
      ADD CONSTRAINT "LabOrder_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrder_billedByUserId_fkey') THEN
    ALTER TABLE "LabOrder"
      ADD CONSTRAINT "LabOrder_billedByUserId_fkey" FOREIGN KEY ("billedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrder_billId_fkey') THEN
    ALTER TABLE "LabOrder"
      ADD CONSTRAINT "LabOrder_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Lab order items
CREATE TABLE IF NOT EXISTS "LabOrderItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "labOrderId" UUID NOT NULL,
  "testId" UUID,
  "testName" TEXT NOT NULL,
  "category" TEXT,
  "unit" TEXT,
  "referenceRange" TEXT,
  "price" INTEGER NOT NULL DEFAULT 0,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LabOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LabOrderItem_labOrderId_idx" ON "LabOrderItem"("labOrderId");
CREATE INDEX IF NOT EXISTS "LabOrderItem_testId_idx" ON "LabOrderItem"("testId");

ALTER TABLE "LabOrderItem"
  ALTER COLUMN "testName" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrderItem_labOrderId_fkey') THEN
    ALTER TABLE "LabOrderItem"
      ADD CONSTRAINT "LabOrderItem_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "LabOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabOrderItem_testId_fkey') THEN
    ALTER TABLE "LabOrderItem"
      ADD CONSTRAINT "LabOrderItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTestCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Lab results
CREATE TABLE IF NOT EXISTS "LabResult" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "labOrderId" UUID NOT NULL,
  "orderItemId" UUID,
  "testName" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "unit" TEXT,
  "referenceRange" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enteredByUserId" UUID,
  CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LabResult_labOrderId_createdAt_idx" ON "LabResult"("labOrderId", "createdAt");
CREATE INDEX IF NOT EXISTS "LabResult_orderItemId_idx" ON "LabResult"("orderItemId");

ALTER TABLE "LabResult"
  ALTER COLUMN "testName" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabResult_labOrderId_fkey') THEN
    ALTER TABLE "LabResult"
      ADD CONSTRAINT "LabResult_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "LabOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabResult_orderItemId_fkey') THEN
    ALTER TABLE "LabResult"
      ADD CONSTRAINT "LabResult_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "LabOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabResult_enteredByUserId_fkey') THEN
    ALTER TABLE "LabResult"
      ADD CONSTRAINT "LabResult_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

