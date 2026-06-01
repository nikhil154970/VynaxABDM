-- AlterEnum
ALTER TYPE "PharmacyStockTransactionType" ADD VALUE IF NOT EXISTS 'BILLING';

-- CreateEnum
CREATE TYPE "PharmacyBillingType" AS ENUM ('HOSPITAL_PATIENT', 'WALK_IN');

-- CreateEnum
CREATE TYPE "PharmacyBillStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PharmacyPaymentMode" AS ENUM ('CASH', 'UPI', 'CARD', 'MIXED');

-- CreateEnum
CREATE TYPE "PharmacyDispenseStatus" AS ENUM ('PENDING', 'DISPENSED');

-- CreateTable
CREATE TABLE "PharmacyBill" (
    "id" UUID NOT NULL,
    "billNumber" TEXT NOT NULL,
    "billingType" "PharmacyBillingType" NOT NULL,
    "patientId" UUID,
    "receptionVisitId" UUID,
    "customerName" TEXT,
    "customerMobile" TEXT,
    "patientName" TEXT,
    "patientUhid" TEXT,
    "tokenNumber" TEXT,
    "doctorName" TEXT,
    "department" TEXT,
    "visitDate" TIMESTAMP(3),
    "subTotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMode" "PharmacyPaymentMode",
    "status" "PharmacyBillStatus" NOT NULL DEFAULT 'DRAFT',
    "dispenseStatus" "PharmacyDispenseStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyBillItem" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "inventoryBatchId" UUID NOT NULL,
    "medicineName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "mrp" DECIMAL(14,2) NOT NULL,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gstPercentage" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PharmacyBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyBill_billNumber_key" ON "PharmacyBill"("billNumber");

-- CreateIndex
CREATE INDEX "PharmacyBill_billNumber_idx" ON "PharmacyBill"("billNumber");

-- CreateIndex
CREATE INDEX "PharmacyBill_patientId_idx" ON "PharmacyBill"("patientId");

-- CreateIndex
CREATE INDEX "PharmacyBill_status_idx" ON "PharmacyBill"("status");

-- CreateIndex
CREATE INDEX "PharmacyBill_billingType_idx" ON "PharmacyBill"("billingType");

-- CreateIndex
CREATE INDEX "PharmacyBill_createdAt_idx" ON "PharmacyBill"("createdAt");

-- CreateIndex
CREATE INDEX "PharmacyBill_dispenseStatus_idx" ON "PharmacyBill"("dispenseStatus");

-- CreateIndex
CREATE INDEX "PharmacyBillItem_billId_idx" ON "PharmacyBillItem"("billId");

-- CreateIndex
CREATE INDEX "PharmacyBillItem_medicineId_idx" ON "PharmacyBillItem"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacyBillItem_inventoryBatchId_idx" ON "PharmacyBillItem"("inventoryBatchId");

-- AddForeignKey
ALTER TABLE "PharmacyBill" ADD CONSTRAINT "PharmacyBill_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyBillItem" ADD CONSTRAINT "PharmacyBillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PharmacyBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyBillItem" ADD CONSTRAINT "PharmacyBillItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyBillItem" ADD CONSTRAINT "PharmacyBillItem_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "PharmacyInventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
