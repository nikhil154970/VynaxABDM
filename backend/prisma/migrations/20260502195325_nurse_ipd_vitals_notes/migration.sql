-- CreateEnum
CREATE TYPE "PatientClinicalCondition" AS ENUM ('CRITICAL', 'STABLE');

-- AlterEnum
ALTER TYPE "AdmissionStatus" ADD VALUE 'DISCHARGE_REQUESTED';

-- DropIndex
DROP INDEX "Consultation_disposition_createdAt_idx";

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "clinicalCondition" "PatientClinicalCondition" NOT NULL DEFAULT 'STABLE',
ADD COLUMN     "dischargeRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LabOrder" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LabOrderItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LabResult" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LabTestCatalog" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "NursingNote" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "nurseId" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NursingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vitals" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "bp" TEXT NOT NULL,
    "temp" DOUBLE PRECISION,
    "pulse" INTEGER,
    "spo2" INTEGER,
    "oxygenTherapy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vitals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NursingNote_admissionId_createdAt_idx" ON "NursingNote"("admissionId", "createdAt");

-- CreateIndex
CREATE INDEX "NursingNote_nurseId_createdAt_idx" ON "NursingNote"("nurseId", "createdAt");

-- CreateIndex
CREATE INDEX "Vitals_admissionId_createdAt_idx" ON "Vitals"("admissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "NursingNote" ADD CONSTRAINT "NursingNote_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingNote" ADD CONSTRAINT "NursingNote_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
