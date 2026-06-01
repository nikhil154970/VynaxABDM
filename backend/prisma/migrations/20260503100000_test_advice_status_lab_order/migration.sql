-- CreateEnum
CREATE TYPE "TestAdviceStatus" AS ENUM ('PENDING_BILLING', 'CONVERTED');

-- AlterTable
ALTER TABLE "TestAdvice" ADD COLUMN "status" "TestAdviceStatus" NOT NULL DEFAULT 'PENDING_BILLING';
ALTER TABLE "TestAdvice" ADD COLUMN "labOrderId" UUID;

-- CreateIndex
CREATE INDEX "TestAdvice_status_createdAt_idx" ON "TestAdvice"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestAdvice_labOrderId_key" ON "TestAdvice"("labOrderId");

-- AddForeignKey
ALTER TABLE "TestAdvice" ADD CONSTRAINT "TestAdvice_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "LabOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
