-- CreateEnum (safe)
DO $$ BEGIN
  CREATE TYPE "RegistrationSource" AS ENUM ('RECEPTION', 'SELF');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Missing columns on existing tables
ALTER TABLE "EquipmentAllocation" ADD COLUMN IF NOT EXISTS "expectedReturnAt" TIMESTAMP(3);

ALTER TABLE "OtRequest" ADD COLUMN IF NOT EXISTS "billDate" TIMESTAMP(3);
ALTER TABLE "OtRequest" ADD COLUMN IF NOT EXISTS "billId" UUID;

ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "registrationSource" "RegistrationSource" NOT NULL DEFAULT 'RECEPTION';

ALTER TABLE "PostSurgeryNote" ADD COLUMN IF NOT EXISTS "anaesthesiaType" TEXT;
ALTER TABLE "PostSurgeryNote" ADD COLUMN IF NOT EXISTS "implantsUsed" TEXT;
ALTER TABLE "PostSurgeryNote" ADD COLUMN IF NOT EXISTS "postOperativeDiagnosis" TEXT;
ALTER TABLE "PostSurgeryNote" ADD COLUMN IF NOT EXISTS "preOperativeDiagnosis" TEXT;
ALTER TABLE "PostSurgeryNote" ADD COLUMN IF NOT EXISTS "specimenCollected" TEXT;

ALTER TABLE "RecoveryAssessment" ADD COLUMN IF NOT EXISTS "postAnaesthesiaMonitoring" TEXT;
ALTER TABLE "RecoveryAssessment" ADD COLUMN IF NOT EXISTS "surgicalSiteAssessment" TEXT;

ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "assignedNurseId" UUID;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "surgicalSiteAssessment" TEXT;
ALTER TABLE "RecoveryRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Index & unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "OtRequest_billId_key" ON "OtRequest"("billId");

-- Foreign keys (safe)
DO $$ BEGIN
  ALTER TABLE "PatientAuth" ADD CONSTRAINT "PatientAuth_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "OtRequest" ADD CONSTRAINT "OtRequest_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SurgerySchedule" ADD CONSTRAINT "SurgerySchedule_assistantSurgeonId_fkey" FOREIGN KEY ("assistantSurgeonId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SurgerySchedule" ADD CONSTRAINT "SurgerySchedule_otNurseId_fkey" FOREIGN KEY ("otNurseId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecoveryRecord" ADD CONSTRAINT "RecoveryRecord_assignedNurseId_fkey" FOREIGN KEY ("assignedNurseId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
