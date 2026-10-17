-- CreateEnum
CREATE TYPE "OtRequestStatus" AS ENUM ('OT_REQUEST_CREATED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'APPROVED_FOR_OT', 'RECEIVED_BY_OT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'CREATE_OT_REQUEST';
ALTER TYPE "ActivityAction" ADD VALUE 'UPDATE_OT_REQUEST_STATUS';

-- AlterEnum
ALTER TYPE "ActivityModule" ADD VALUE 'OT';

-- CreateTable
CREATE TABLE "OtRequest" (
    "id" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "patientId" UUID NOT NULL,
    "uhid" TEXT NOT NULL,
    "ipdId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "nurseId" UUID NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "surgeryRecommendation" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "expectedSurgeryDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "OtRequestStatus" NOT NULL DEFAULT 'OT_REQUEST_CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtRequestStatusHistory" (
    "id" UUID NOT NULL,
    "otRequestId" UUID NOT NULL,
    "status" "OtRequestStatus" NOT NULL,
    "changedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtRequestStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OtRequest_requestNumber_key" ON "OtRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "OtRequest_patientId_idx" ON "OtRequest"("patientId");

-- CreateIndex
CREATE INDEX "OtRequest_doctorId_idx" ON "OtRequest"("doctorId");

-- CreateIndex
CREATE INDEX "OtRequest_nurseId_idx" ON "OtRequest"("nurseId");

-- CreateIndex
CREATE INDEX "OtRequest_status_idx" ON "OtRequest"("status");

-- CreateIndex
CREATE INDEX "OtRequest_createdAt_idx" ON "OtRequest"("createdAt");

-- CreateIndex
CREATE INDEX "OtRequestStatusHistory_otRequestId_idx" ON "OtRequestStatusHistory"("otRequestId");

-- CreateIndex
CREATE INDEX "OtRequestStatusHistory_createdAt_idx" ON "OtRequestStatusHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "OtRequest" ADD CONSTRAINT "OtRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtRequest" ADD CONSTRAINT "OtRequest_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtRequest" ADD CONSTRAINT "OtRequest_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtRequest" ADD CONSTRAINT "OtRequest_ipdId_fkey" FOREIGN KEY ("ipdId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtRequestStatusHistory" ADD CONSTRAINT "OtRequestStatusHistory_otRequestId_fkey" FOREIGN KEY ("otRequestId") REFERENCES "OtRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtRequestStatusHistory" ADD CONSTRAINT "OtRequestStatusHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
