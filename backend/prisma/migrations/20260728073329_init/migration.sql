-- AlterTable
ALTER TABLE "LabResult" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "NursingNote" ADD COLUMN     "showInHistory" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TreatmentPlanHistory" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "medicines" JSONB NOT NULL,
    "instructions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentPlanHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreatmentPlanHistory_admissionId_createdAt_idx" ON "TreatmentPlanHistory"("admissionId", "createdAt");

-- CreateIndex
CREATE INDEX "TreatmentPlanHistory_doctorId_createdAt_idx" ON "TreatmentPlanHistory"("doctorId", "createdAt");

-- AddForeignKey
ALTER TABLE "TreatmentPlanHistory" ADD CONSTRAINT "TreatmentPlanHistory_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanHistory" ADD CONSTRAINT "TreatmentPlanHistory_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
