-- CreateEnum: OtRoomStatus (missing from previous migration)
DO $$ BEGIN
  CREATE TYPE "OtRoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: OtRoom (missing from previous migration)
CREATE TABLE IF NOT EXISTS "OtRoom" (
    "id" UUID NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "floor" TEXT,
    "status" "OtRoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "occupiedSince" TIMESTAMP(3),
    "expectedAvailableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OtRoom_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OtRoom_roomNumber_key" ON "OtRoom"("roomNumber");
CREATE INDEX IF NOT EXISTS "OtRoom_status_idx" ON "OtRoom"("status");

-- CreateTable: SurgerySchedule (missing from previous migration)
CREATE TABLE IF NOT EXISTS "SurgerySchedule" (
    "id" UUID NOT NULL,
    "otRequestId" UUID NOT NULL,
    "surgeryDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "estimatedDuration" INTEGER NOT NULL,
    "otRoomId" UUID NOT NULL,
    "surgeonId" UUID NOT NULL,
    "assistantSurgeonId" UUID,
    "otNurseId" UUID,
    "anaesthetistId" UUID NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "rescheduledAt" TIMESTAMP(3),
    "rescheduleReason" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SurgerySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SurgerySchedule_otRequestId_key" ON "SurgerySchedule"("otRequestId");
CREATE INDEX IF NOT EXISTS "SurgerySchedule_surgeryDate_idx" ON "SurgerySchedule"("surgeryDate");
CREATE INDEX IF NOT EXISTS "SurgerySchedule_otRoomId_idx" ON "SurgerySchedule"("otRoomId");
CREATE INDEX IF NOT EXISTS "SurgerySchedule_surgeonId_idx" ON "SurgerySchedule"("surgeonId");
CREATE INDEX IF NOT EXISTS "SurgerySchedule_status_idx" ON "SurgerySchedule"("status");

-- AddForeignKey
ALTER TABLE "SurgerySchedule" ADD CONSTRAINT "SurgerySchedule_otRequestId_fkey" FOREIGN KEY ("otRequestId") REFERENCES "OtRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurgerySchedule" ADD CONSTRAINT "SurgerySchedule_otRoomId_fkey" FOREIGN KEY ("otRoomId") REFERENCES "OtRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurgerySchedule" ADD CONSTRAINT "SurgerySchedule_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurgerySchedule" ADD CONSTRAINT "SurgerySchedule_anaesthetistId_fkey" FOREIGN KEY ("anaesthetistId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurgerySchedule" ADD CONSTRAINT "SurgerySchedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add surgerySessionId column to SurgerySchedule
ALTER TABLE "SurgerySchedule" ADD COLUMN IF NOT EXISTS "surgerySessionId" UUID;

-- CreateTable: EquipmentInventory
CREATE TABLE IF NOT EXISTS "EquipmentInventory" (
    "id" UUID NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "serialNumber" TEXT,
    "maintenanceDate" TIMESTAMP(3),
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EquipmentInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EquipmentInventory_category_idx" ON "EquipmentInventory"("category");

-- CreateTable: ConsumableInventory
CREATE TABLE IF NOT EXISTS "ConsumableInventory" (
    "id" UUID NOT NULL,
    "consumableName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pieces',
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConsumableInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsumableInventory_category_idx" ON "ConsumableInventory"("category");

-- CreateTable: SurgerySession (must come before EquipmentAllocation and ConsumableUsage)
CREATE TABLE IF NOT EXISTS "SurgerySession" (
    "id" UUID NOT NULL,
    "surgeryScheduleId" UUID NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SurgerySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SurgerySession_surgeryScheduleId_key" ON "SurgerySession"("surgeryScheduleId");

-- AddForeignKey
ALTER TABLE "SurgerySession" ADD CONSTRAINT "SurgerySession_surgeryScheduleId_fkey" FOREIGN KEY ("surgeryScheduleId") REFERENCES "SurgerySchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: EquipmentAllocation
CREATE TABLE IF NOT EXISTS "EquipmentAllocation" (
    "id" UUID NOT NULL,
    "surgerySessionId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "quantityAllocated" INTEGER NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    CONSTRAINT "EquipmentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EquipmentAllocation_surgerySessionId_idx" ON "EquipmentAllocation"("surgerySessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EquipmentAllocation_equipmentId_idx" ON "EquipmentAllocation"("equipmentId");

-- AddForeignKey
ALTER TABLE "EquipmentAllocation" ADD CONSTRAINT "EquipmentAllocation_surgerySessionId_fkey" FOREIGN KEY ("surgerySessionId") REFERENCES "SurgerySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAllocation" ADD CONSTRAINT "EquipmentAllocation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ConsumableUsage
CREATE TABLE IF NOT EXISTS "ConsumableUsage" (
    "id" UUID NOT NULL,
    "surgerySessionId" UUID NOT NULL,
    "consumableId" UUID NOT NULL,
    "quantityUsed" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsumableUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsumableUsage_surgerySessionId_idx" ON "ConsumableUsage"("surgerySessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsumableUsage_consumableId_idx" ON "ConsumableUsage"("consumableId");

-- AddForeignKey
ALTER TABLE "ConsumableUsage" ADD CONSTRAINT "ConsumableUsage_surgerySessionId_fkey" FOREIGN KEY ("surgerySessionId") REFERENCES "SurgerySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableUsage" ADD CONSTRAINT "ConsumableUsage_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "ConsumableInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: RecoveryRecord
CREATE TABLE IF NOT EXISTS "RecoveryRecord" (
    "id" UUID NOT NULL,
    "surgerySessionId" UUID NOT NULL,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "pulse" INTEGER,
    "temperature" DOUBLE PRECISION,
    "spo2" INTEGER,
    "recoveryNotes" TEXT,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    CONSTRAINT "RecoveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RecoveryRecord_surgerySessionId_key" ON "RecoveryRecord"("surgerySessionId");

-- AddForeignKey
ALTER TABLE "RecoveryRecord" ADD CONSTRAINT "RecoveryRecord_surgerySessionId_fkey" FOREIGN KEY ("surgerySessionId") REFERENCES "SurgerySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: PostSurgeryNote
CREATE TABLE IF NOT EXISTS "PostSurgeryNote" (
    "id" UUID NOT NULL,
    "surgerySessionId" UUID NOT NULL,
    "surgeryOutcome" TEXT,
    "procedureSummary" TEXT,
    "surgeonNotes" TEXT,
    "complications" TEXT,
    "followUpInstructions" TEXT,
    "medicines" TEXT,
    "dischargeRecommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PostSurgeryNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostSurgeryNote_surgerySessionId_key" ON "PostSurgeryNote"("surgerySessionId");

-- AddForeignKey
ALTER TABLE "PostSurgeryNote" ADD CONSTRAINT "PostSurgeryNote_surgerySessionId_fkey" FOREIGN KEY ("surgerySessionId") REFERENCES "SurgerySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
