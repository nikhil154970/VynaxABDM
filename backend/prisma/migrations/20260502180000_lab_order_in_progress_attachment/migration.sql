-- Lab workflow: processing step between collected and completed
ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

-- Optional file per result row (URL or path from upload service)
ALTER TABLE "LabResult" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
