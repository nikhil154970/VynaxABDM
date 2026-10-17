-- CreateEnum
CREATE TYPE "AbdmTokenType" AS ENUM ('GATEWAY', 'ABHA_XTOKEN', 'LINK_TOKEN');

-- CreateEnum
CREATE TYPE "AbdmAuditDirection" AS ENUM ('OUT', 'IN');

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "hospitalId" UUID;

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "hospitalId" UUID;

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN     "hospitalId" UUID;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "hospitalId" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hospitalId" UUID;

-- AlterTable
ALTER TABLE "Ward" ADD COLUMN     "hospitalId" UUID;

-- CreateTable
CREATE TABLE "Hospital" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbdmFacilityConfig" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "facilityId" TEXT NOT NULL,
    "facilityName" TEXT NOT NULL,
    "hipId" TEXT,
    "hiuId" TEXT,
    "bridgeId" TEXT NOT NULL,
    "bridgeUrl" TEXT,
    "isHipActive" BOOLEAN NOT NULL DEFAULT false,
    "isHiuActive" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3),

    CONSTRAINT "AbdmFacilityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbdmTokenCache" (
    "id" UUID NOT NULL,
    "tokenType" "AbdmTokenType" NOT NULL,
    "key" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "meta" JSONB,

    CONSTRAINT "AbdmTokenCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbdmAuditLog" (
    "id" UUID NOT NULL,
    "hospitalId" UUID,
    "direction" "AbdmAuditDirection" NOT NULL,
    "apiName" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseHash" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbdmAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_code_key" ON "Hospital"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AbdmFacilityConfig_hospitalId_key" ON "AbdmFacilityConfig"("hospitalId");

-- CreateIndex
CREATE INDEX "AbdmFacilityConfig_facilityId_idx" ON "AbdmFacilityConfig"("facilityId");

-- CreateIndex
CREATE INDEX "AbdmAuditLog_hospitalId_idx" ON "AbdmAuditLog"("hospitalId");

-- CreateIndex
CREATE INDEX "AbdmAuditLog_requestId_idx" ON "AbdmAuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AbdmAuditLog_createdAt_idx" ON "AbdmAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Admission_hospitalId_idx" ON "Admission"("hospitalId");

-- CreateIndex
CREATE INDEX "Consultation_hospitalId_idx" ON "Consultation"("hospitalId");

-- CreateIndex
CREATE INDEX "LabOrder_hospitalId_idx" ON "LabOrder"("hospitalId");

-- CreateIndex
CREATE INDEX "Patient_hospitalId_idx" ON "Patient"("hospitalId");

-- CreateIndex
CREATE INDEX "User_hospitalId_idx" ON "User"("hospitalId");

-- CreateIndex
CREATE INDEX "Ward_hospitalId_idx" ON "Ward"("hospitalId");

-- AddForeignKey
ALTER TABLE "AbdmFacilityConfig" ADD CONSTRAINT "AbdmFacilityConfig_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbdmAuditLog" ADD CONSTRAINT "AbdmAuditLog_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
