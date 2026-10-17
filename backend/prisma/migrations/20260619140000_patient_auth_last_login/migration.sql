-- CreateTable: PatientAuth (missing from previous migration)
CREATE TABLE IF NOT EXISTS "PatientAuth" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientAuth_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PatientAuth_patientId_key" ON "PatientAuth"("patientId");
CREATE INDEX IF NOT EXISTS "PatientAuth_patientId_idx" ON "PatientAuth"("patientId");

-- AlterTable
ALTER TABLE "PatientAuth" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
