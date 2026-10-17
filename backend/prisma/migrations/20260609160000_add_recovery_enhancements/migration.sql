-- Add new columns to RecoveryRecord
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "respiratoryRate" INTEGER;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "painScore" INTEGER;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "consciousnessLevel" TEXT;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "postAnaesthesiaMonitoring" TEXT;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'UNDER_OBSERVATION';
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "transferredTo" TEXT;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "transferredAt" TIMESTAMP(3);
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create RecoveryTimeline table
CREATE TABLE IF NOT EXISTS "RecoveryTimeline" (
    "id" UUID NOT NULL,
    "recoveryRecordId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDescription" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecoveryTimeline_recoveryRecordId_idx" ON "RecoveryTimeline"("recoveryRecordId");
CREATE INDEX IF NOT EXISTS "RecoveryTimeline_createdAt_idx" ON "RecoveryTimeline"("createdAt");

-- AddForeignKey
ALTER TABLE "RecoveryTimeline" ADD CONSTRAINT "RecoveryTimeline_recoveryRecordId_fkey" FOREIGN KEY ("recoveryRecordId") REFERENCES "RecoveryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
