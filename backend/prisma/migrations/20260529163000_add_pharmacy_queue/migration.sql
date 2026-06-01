-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'BILLED');

-- CreateTable
CREATE TABLE "PharmacyQueue" (
    "id" TEXT NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "prescriptionId" UUID,
    "doctorId" UUID,
    "sentByReceptionistId" UUID NOT NULL,
    "tokenNumber" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "sentAt" TIMESTAMP(3) NOT NULL,
    "billedBillId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyQueueItem" (
    "id" UUID NOT NULL,
    "queueId" TEXT NOT NULL,
    "medicineId" UUID,
    "medicineName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyQueue_tokenNumber_key" ON "PharmacyQueue"("tokenNumber");

-- CreateIndex
CREATE INDEX "PharmacyQueue_status_sentAt_idx" ON "PharmacyQueue"("status", "sentAt");

-- CreateIndex
CREATE INDEX "PharmacyQueue_patientId_sentAt_idx" ON "PharmacyQueue"("patientId", "sentAt");

-- CreateIndex
CREATE INDEX "PharmacyQueue_doctorId_sentAt_idx" ON "PharmacyQueue"("doctorId", "sentAt");

-- CreateIndex
CREATE INDEX "PharmacyQueue_sentByReceptionistId_sentAt_idx" ON "PharmacyQueue"("sentByReceptionistId", "sentAt");

-- CreateIndex
CREATE INDEX "PharmacyQueueItem_queueId_idx" ON "PharmacyQueueItem"("queueId");

-- CreateIndex
CREATE INDEX "PharmacyQueueItem_medicineId_idx" ON "PharmacyQueueItem"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacyQueueItem_medicineName_idx" ON "PharmacyQueueItem"("medicineName");

-- AddForeignKey
ALTER TABLE "PharmacyQueue" ADD CONSTRAINT "PharmacyQueue_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyQueue" ADD CONSTRAINT "PharmacyQueue_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyQueue" ADD CONSTRAINT "PharmacyQueue_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyQueue" ADD CONSTRAINT "PharmacyQueue_sentByReceptionistId_fkey" FOREIGN KEY ("sentByReceptionistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyQueueItem" ADD CONSTRAINT "PharmacyQueueItem_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "PharmacyQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyQueueItem" ADD CONSTRAINT "PharmacyQueueItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

