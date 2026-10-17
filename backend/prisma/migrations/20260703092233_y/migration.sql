/*
  Warnings:

  - You are about to drop the column `surgerySessionId` on the `SurgerySchedule` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OtMedicineIssueStatus" AS ENUM ('REQUESTED', 'ISSUED', 'IN_USE', 'RETURN_PENDING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OtMedicineMovementType" AS ENUM ('REQUEST', 'ISSUE', 'USE', 'RETURN_SUBMITTED', 'RETURN_CONFIRMED', 'VOID', 'ADJUSTMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PharmacyStockTransactionType" ADD VALUE 'OT_ISSUE';
ALTER TYPE "PharmacyStockTransactionType" ADD VALUE 'OT_RETURN';

-- DropForeignKey
ALTER TABLE "ComplicationTracking" DROP CONSTRAINT "ComplicationTracking_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "ComplicationTracking" DROP CONSTRAINT "ComplicationTracking_postSurgeryNoteId_fkey";

-- DropForeignKey
ALTER TABLE "FollowUpHistory" DROP CONSTRAINT "FollowUpHistory_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "FollowUpHistory" DROP CONSTRAINT "FollowUpHistory_postSurgeryNoteId_fkey";

-- DropForeignKey
ALTER TABLE "RecoveryTransfer" DROP CONSTRAINT "RecoveryTransfer_assignedBedId_fkey";

-- DropForeignKey
ALTER TABLE "SurgeryAuditTrail" DROP CONSTRAINT "SurgeryAuditTrail_changedBy_fkey";

-- DropForeignKey
ALTER TABLE "SurgeryAuditTrail" DROP CONSTRAINT "SurgeryAuditTrail_surgerySessionId_fkey";

-- DropIndex
DROP INDEX "OtRoom_status_idx";

-- AlterTable
ALTER TABLE "SurgerySchedule" DROP COLUMN "surgerySessionId";

-- AlterTable
ALTER TABLE "TestAdvice" ADD COLUMN     "admissionId" UUID,
ADD COLUMN     "clinicalNote" TEXT,
ADD COLUMN     "requestedByUserId" UUID,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "NurseTask" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT,
    "nurseId" UUID NOT NULL,
    "task" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NurseTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorOrder" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT,
    "nurseId" UUID NOT NULL,
    "orderText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtMedicineIssue" (
    "id" UUID NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "surgerySessionId" UUID NOT NULL,
    "otRequestId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" "OtMedicineIssueStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" UUID,
    "requestedByName" TEXT,
    "requestedAt" TIMESTAMP(3),
    "issuedById" UUID,
    "issuedByName" TEXT,
    "issuedAt" TIMESTAMP(3),
    "receivedByOtId" UUID,
    "receivedByOtName" TEXT,
    "returnSubmittedAt" TIMESTAMP(3),
    "returnConfirmedAt" TIMESTAMP(3),
    "returnConfirmedById" UUID,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtMedicineIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtMedicineIssueItem" (
    "id" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "inventoryBatchId" UUID NOT NULL,
    "medicineName" TEXT NOT NULL,
    "genericName" TEXT,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "quantityRequested" INTEGER NOT NULL DEFAULT 0,
    "quantityIssued" INTEGER NOT NULL DEFAULT 0,
    "quantityUsed" INTEGER NOT NULL DEFAULT 0,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "quantityReturnPending" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "lineIssuedTotal" INTEGER NOT NULL DEFAULT 0,
    "lineUsedTotal" INTEGER NOT NULL DEFAULT 0,
    "lineReturnedTotal" INTEGER NOT NULL DEFAULT 0,
    "lineNetTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtMedicineIssueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtMedicineMovement" (
    "id" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "issueItemId" UUID,
    "movementType" "OtMedicineMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "movementAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" UUID NOT NULL,
    "performedByName" TEXT,
    "notes" TEXT,

    CONSTRAINT "OtMedicineMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NurseTask_nurseId_idx" ON "NurseTask"("nurseId");

-- CreateIndex
CREATE INDEX "NurseTask_admissionId_idx" ON "NurseTask"("admissionId");

-- CreateIndex
CREATE INDEX "NurseTask_status_idx" ON "NurseTask"("status");

-- CreateIndex
CREATE INDEX "DoctorOrder_nurseId_idx" ON "DoctorOrder"("nurseId");

-- CreateIndex
CREATE INDEX "DoctorOrder_admissionId_idx" ON "DoctorOrder"("admissionId");

-- CreateIndex
CREATE INDEX "DoctorOrder_status_idx" ON "DoctorOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OtMedicineIssue_issueNumber_key" ON "OtMedicineIssue"("issueNumber");

-- CreateIndex
CREATE INDEX "OtMedicineIssue_surgerySessionId_idx" ON "OtMedicineIssue"("surgerySessionId");

-- CreateIndex
CREATE INDEX "OtMedicineIssue_otRequestId_idx" ON "OtMedicineIssue"("otRequestId");

-- CreateIndex
CREATE INDEX "OtMedicineIssue_patientId_idx" ON "OtMedicineIssue"("patientId");

-- CreateIndex
CREATE INDEX "OtMedicineIssue_status_idx" ON "OtMedicineIssue"("status");

-- CreateIndex
CREATE INDEX "OtMedicineIssue_createdAt_idx" ON "OtMedicineIssue"("createdAt");

-- CreateIndex
CREATE INDEX "OtMedicineIssueItem_issueId_idx" ON "OtMedicineIssueItem"("issueId");

-- CreateIndex
CREATE INDEX "OtMedicineIssueItem_medicineId_idx" ON "OtMedicineIssueItem"("medicineId");

-- CreateIndex
CREATE INDEX "OtMedicineIssueItem_inventoryBatchId_idx" ON "OtMedicineIssueItem"("inventoryBatchId");

-- CreateIndex
CREATE INDEX "OtMedicineMovement_issueId_movementAt_idx" ON "OtMedicineMovement"("issueId", "movementAt");

-- CreateIndex
CREATE INDEX "OtMedicineMovement_movementType_idx" ON "OtMedicineMovement"("movementType");

-- CreateIndex
CREATE INDEX "TestAdvice_admissionId_createdAt_idx" ON "TestAdvice"("admissionId", "createdAt");

-- CreateIndex
CREATE INDEX "TestAdvice_source_status_createdAt_idx" ON "TestAdvice"("source", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "TestAdvice" ADD CONSTRAINT "TestAdvice_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAdvice" ADD CONSTRAINT "TestAdvice_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseTask" ADD CONSTRAINT "NurseTask_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorOrder" ADD CONSTRAINT "DoctorOrder_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtMedicineIssue" ADD CONSTRAINT "OtMedicineIssue_surgerySessionId_fkey" FOREIGN KEY ("surgerySessionId") REFERENCES "SurgerySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtMedicineIssue" ADD CONSTRAINT "OtMedicineIssue_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtMedicineIssueItem" ADD CONSTRAINT "OtMedicineIssueItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "OtMedicineIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtMedicineMovement" ADD CONSTRAINT "OtMedicineMovement_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "OtMedicineIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
