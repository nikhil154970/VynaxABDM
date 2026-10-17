-- Create missing enums (only if they don't exist)
DO $$ BEGIN
  CREATE TYPE "DutyType" AS ENUM ('WARD', 'RECOVERY', 'OT', 'EMERGENCY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DutyStatus" AS ENUM ('UPCOMING', 'ON_DUTY', 'COMPLETED', 'OFF_DUTY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable: PreOperativeAssessment
CREATE TABLE IF NOT EXISTS "PreOperativeAssessment" (
    "id" UUID NOT NULL,
    "otRequestId" UUID NOT NULL,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "pulse" INTEGER,
    "temperature" DOUBLE PRECISION,
    "spo2" INTEGER,
    "respiratoryRate" INTEGER,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "bmi" DOUBLE PRECISION,
    "diabetes" BOOLEAN NOT NULL DEFAULT false,
    "hypertension" BOOLEAN NOT NULL DEFAULT false,
    "asthma" BOOLEAN NOT NULL DEFAULT false,
    "heartDisease" BOOLEAN NOT NULL DEFAULT false,
    "kidneyDisease" BOOLEAN NOT NULL DEFAULT false,
    "knownAllergies" TEXT,
    "currentMedications" TEXT,
    "previousSurgeries" TEXT,
    "nurseNotes" TEXT,
    "consentObtained" BOOLEAN NOT NULL DEFAULT false,
    "labReportsAvailable" BOOLEAN NOT NULL DEFAULT false,
    "fastingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "bloodAvailable" BOOLEAN NOT NULL DEFAULT false,
    "surgicalSiteVerified" BOOLEAN NOT NULL DEFAULT false,
    "patientIdentityVerified" BOOLEAN NOT NULL DEFAULT false,
    "assessedById" UUID NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PreOperativeAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Department
CREATE TABLE IF NOT EXISTS "Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Shift
CREATE TABLE IF NOT EXISTS "Shift" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ShiftAssignment
CREATE TABLE IF NOT EXISTS "ShiftAssignment" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ShiftHistory
CREATE TABLE IF NOT EXISTS "ShiftHistory" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "previousShiftId" UUID,
    "newShiftId" UUID,
    "changedById" UUID NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AllocationRequest
CREATE TABLE IF NOT EXISTS "AllocationRequest" (
    "id" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "patientId" UUID NOT NULL,
    "uhid" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "admissionId" UUID,
    "otRequestId" UUID,
    "sourceModule" TEXT NOT NULL,
    "department" TEXT,
    "requestedStaffType" TEXT NOT NULL,
    "reason" TEXT,
    "requiredShift" TEXT,
    "assignedShift" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "assignedToId" UUID,
    "assignedToName" TEXT,
    "assignedById" UUID,
    "assignedByName" TEXT,
    "assignedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" UUID,
    "rejectedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AllocationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AllocationRequestHistory
CREATE TABLE IF NOT EXISTS "AllocationRequestHistory" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "userName" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllocationRequestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NurseDuty
CREATE TABLE IF NOT EXISTS "NurseDuty" (
    "id" UUID NOT NULL,
    "nurseId" UUID NOT NULL,
    "nurseName" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "wardName" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "dutyDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NurseDuty_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DutyRoster
CREATE TABLE IF NOT EXISTS "DutyRoster" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "department" TEXT,
    "dutyType" "DutyType" NOT NULL,
    "dutyLocation" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "status" "DutyStatus" NOT NULL DEFAULT 'UPCOMING',
    "remarks" TEXT,
    "wardType" "WardType",
    "assignedPatientIds" TEXT,
    "bedIds" TEXT,
    "otRoomName" TEXT,
    "surgeryId" TEXT,
    "surgeonName" TEXT,
    "timeSlot" TEXT,
    "recoveryRoomName" TEXT,
    "patientCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DutyRoster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique + performance)
CREATE UNIQUE INDEX IF NOT EXISTS "PreOperativeAssessment_otRequestId_key" ON "PreOperativeAssessment"("otRequestId");
CREATE INDEX IF NOT EXISTS "PreOperativeAssessment_otRequestId_idx" ON "PreOperativeAssessment"("otRequestId");
CREATE INDEX IF NOT EXISTS "PreOperativeAssessment_assessedById_idx" ON "PreOperativeAssessment"("assessedById");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_headId_key" ON "Department"("headId");
CREATE INDEX IF NOT EXISTS "Department_isActive_idx" ON "Department"("isActive");
CREATE INDEX IF NOT EXISTS "Shift_isActive_idx" ON "Shift"("isActive");
CREATE INDEX IF NOT EXISTS "ShiftAssignment_shiftId_idx" ON "ShiftAssignment"("shiftId");
CREATE INDEX IF NOT EXISTS "ShiftAssignment_employeeId_idx" ON "ShiftAssignment"("employeeId");
CREATE INDEX IF NOT EXISTS "ShiftAssignment_assignedDate_idx" ON "ShiftAssignment"("assignedDate");
CREATE INDEX IF NOT EXISTS "ShiftHistory_assignmentId_idx" ON "ShiftHistory"("assignmentId");
CREATE INDEX IF NOT EXISTS "ShiftHistory_createdAt_idx" ON "ShiftHistory"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AllocationRequest_requestNumber_key" ON "AllocationRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "AllocationRequest_status_idx" ON "AllocationRequest"("status");
CREATE INDEX IF NOT EXISTS "AllocationRequest_priority_idx" ON "AllocationRequest"("priority");
CREATE INDEX IF NOT EXISTS "AllocationRequest_sourceModule_idx" ON "AllocationRequest"("sourceModule");
CREATE INDEX IF NOT EXISTS "AllocationRequest_uhid_idx" ON "AllocationRequest"("uhid");
CREATE INDEX IF NOT EXISTS "AllocationRequest_createdAt_idx" ON "AllocationRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "AllocationRequestHistory_requestId_idx" ON "AllocationRequestHistory"("requestId");
CREATE INDEX IF NOT EXISTS "AllocationRequestHistory_createdAt_idx" ON "AllocationRequestHistory"("createdAt");
CREATE INDEX IF NOT EXISTS "NurseDuty_nurseId_idx" ON "NurseDuty"("nurseId");
CREATE INDEX IF NOT EXISTS "NurseDuty_wardId_idx" ON "NurseDuty"("wardId");
CREATE INDEX IF NOT EXISTS "NurseDuty_dutyDate_idx" ON "NurseDuty"("dutyDate");
CREATE UNIQUE INDEX IF NOT EXISTS "NurseDuty_nurseId_dutyDate_shift_key" ON "NurseDuty"("nurseId", "dutyDate", "shift");
CREATE INDEX IF NOT EXISTS "DutyRoster_employeeId_idx" ON "DutyRoster"("employeeId");
CREATE INDEX IF NOT EXISTS "DutyRoster_date_idx" ON "DutyRoster"("date");
CREATE INDEX IF NOT EXISTS "DutyRoster_shift_idx" ON "DutyRoster"("shift");
CREATE INDEX IF NOT EXISTS "DutyRoster_dutyType_idx" ON "DutyRoster"("dutyType");
CREATE INDEX IF NOT EXISTS "DutyRoster_status_idx" ON "DutyRoster"("status");
CREATE INDEX IF NOT EXISTS "DutyRoster_employeeId_date_shift_idx" ON "DutyRoster"("employeeId", "date", "shift");

-- AddForeignKey (only if not already present - use DO blocks to skip duplicates)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PreOperativeAssessment_otRequestId_fkey') THEN
    ALTER TABLE "PreOperativeAssessment" ADD CONSTRAINT "PreOperativeAssessment_otRequestId_fkey" FOREIGN KEY ("otRequestId") REFERENCES "OtRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PreOperativeAssessment_assessedById_fkey') THEN
    ALTER TABLE "PreOperativeAssessment" ADD CONSTRAINT "PreOperativeAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Department_headId_fkey') THEN
    ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShiftAssignment_shiftId_fkey') THEN
    ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShiftAssignment_employeeId_fkey') THEN
    ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShiftAssignment_assignedById_fkey') THEN
    ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShiftHistory_assignmentId_fkey') THEN
    ALTER TABLE "ShiftHistory" ADD CONSTRAINT "ShiftHistory_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ShiftAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShiftHistory_previousShiftId_fkey') THEN
    ALTER TABLE "ShiftHistory" ADD CONSTRAINT "ShiftHistory_previousShiftId_fkey" FOREIGN KEY ("previousShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShiftHistory_newShiftId_fkey') THEN
    ALTER TABLE "ShiftHistory" ADD CONSTRAINT "ShiftHistory_newShiftId_fkey" FOREIGN KEY ("newShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShiftHistory_changedById_fkey') THEN
    ALTER TABLE "ShiftHistory" ADD CONSTRAINT "ShiftHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AllocationRequestHistory_requestId_fkey') THEN
    ALTER TABLE "AllocationRequestHistory" ADD CONSTRAINT "AllocationRequestHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AllocationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
