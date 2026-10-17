-- Add new columns to PostSurgeryNote
ALTER TABLE "PostSurgeryNote" ADD COLUMN IF NOT EXISTS "operationFindings" TEXT;
ALTER TABLE "PostSurgeryNote" ADD COLUMN IF NOT EXISTS "bloodLoss" TEXT;
ALTER TABLE "PostSurgeryNote" ADD COLUMN IF NOT EXISTS "specialInstructions" TEXT;

-- Create RecoveryAssessment table
CREATE TABLE IF NOT EXISTS "RecoveryAssessment" (
    "id" UUID NOT NULL,
    "recoveryRecordId" UUID NOT NULL,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "pulse" INTEGER,
    "temperature" DOUBLE PRECISION,
    "spo2" INTEGER,
    "respiratoryRate" INTEGER,
    "painScore" INTEGER,
    "consciousnessLevel" TEXT,
    "status" TEXT,
    "recoveryNotes" TEXT,
    "assessedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryAssessment_pkey" PRIMARY KEY ("id")
);

-- Create FollowUpHistory table
CREATE TABLE IF NOT EXISTS "FollowUpHistory" (
    "id" UUID NOT NULL,
    "postSurgeryNoteId" UUID NOT NULL,
    "doctorNotes" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUpHistory_pkey" PRIMARY KEY ("id")
);

-- Create ComplicationTracking table
CREATE TABLE IF NOT EXISTS "ComplicationTracking" (
    "id" UUID NOT NULL,
    "postSurgeryNoteId" UUID NOT NULL,
    "complicationType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT,
    "actionTaken" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplicationTracking_pkey" PRIMARY KEY ("id")
);

-- Create SurgeryAuditTrail table
CREATE TABLE IF NOT EXISTS "SurgeryAuditTrail" (
    "id" UUID NOT NULL,
    "surgerySessionId" UUID NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurgeryAuditTrail_pkey" PRIMARY KEY ("id")
);

-- Create RecoveryTransfer table
CREATE TABLE IF NOT EXISTS "RecoveryTransfer" (
    "id" UUID NOT NULL,
    "recoveryRecordId" UUID NOT NULL,
    "transferType" TEXT NOT NULL,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "assignedBedId" UUID,
    "assignedBedCode" TEXT,
    "reason" TEXT,
    "transferredById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecoveryAssessment_recoveryRecordId_idx" ON "RecoveryAssessment"("recoveryRecordId");
CREATE INDEX IF NOT EXISTS "RecoveryAssessment_createdAt_idx" ON "RecoveryAssessment"("createdAt");
CREATE INDEX IF NOT EXISTS "FollowUpHistory_postSurgeryNoteId_idx" ON "FollowUpHistory"("postSurgeryNoteId");
CREATE INDEX IF NOT EXISTS "FollowUpHistory_createdAt_idx" ON "FollowUpHistory"("createdAt");
CREATE INDEX IF NOT EXISTS "ComplicationTracking_postSurgeryNoteId_idx" ON "ComplicationTracking"("postSurgeryNoteId");
CREATE INDEX IF NOT EXISTS "ComplicationTracking_createdAt_idx" ON "ComplicationTracking"("createdAt");
CREATE INDEX IF NOT EXISTS "SurgeryAuditTrail_surgerySessionId_idx" ON "SurgeryAuditTrail"("surgerySessionId");
CREATE INDEX IF NOT EXISTS "SurgeryAuditTrail_createdAt_idx" ON "SurgeryAuditTrail"("createdAt");
CREATE INDEX IF NOT EXISTS "RecoveryTransfer_recoveryRecordId_idx" ON "RecoveryTransfer"("recoveryRecordId");
CREATE INDEX IF NOT EXISTS "RecoveryTransfer_createdAt_idx" ON "RecoveryTransfer"("createdAt");

-- AddForeignKeys
ALTER TABLE "RecoveryAssessment" ADD CONSTRAINT "RecoveryAssessment_recoveryRecordId_fkey" FOREIGN KEY ("recoveryRecordId") REFERENCES "RecoveryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecoveryAssessment" ADD CONSTRAINT "RecoveryAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUpHistory" ADD CONSTRAINT "FollowUpHistory_postSurgeryNoteId_fkey" FOREIGN KEY ("postSurgeryNoteId") REFERENCES "PostSurgeryNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUpHistory" ADD CONSTRAINT "FollowUpHistory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplicationTracking" ADD CONSTRAINT "ComplicationTracking_postSurgeryNoteId_fkey" FOREIGN KEY ("postSurgeryNoteId") REFERENCES "PostSurgeryNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplicationTracking" ADD CONSTRAINT "ComplicationTracking_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurgeryAuditTrail" ADD CONSTRAINT "SurgeryAuditTrail_surgerySessionId_fkey" FOREIGN KEY ("surgerySessionId") REFERENCES "SurgerySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurgeryAuditTrail" ADD CONSTRAINT "SurgeryAuditTrail_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecoveryTransfer" ADD CONSTRAINT "RecoveryTransfer_recoveryRecordId_fkey" FOREIGN KEY ("recoveryRecordId") REFERENCES "RecoveryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecoveryTransfer" ADD CONSTRAINT "RecoveryTransfer_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecoveryTransfer" ADD CONSTRAINT "RecoveryTransfer_assignedBedId_fkey" FOREIGN KEY ("assignedBedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
