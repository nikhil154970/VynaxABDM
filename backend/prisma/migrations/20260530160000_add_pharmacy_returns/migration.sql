-- CreateEnum
CREATE TYPE "PharmacyReturnType" AS ENUM ('CUSTOMER_RETURN', 'VENDOR_RETURN', 'EXPIRED_RETURN', 'DAMAGED_RETURN');
CREATE TYPE "PharmacyReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PharmacyRefundType" AS ENUM ('CASH', 'UPI', 'STORE_CREDIT', 'NO_REFUND');

-- AlterEnum
ALTER TYPE "PharmacyStockTransactionType" ADD VALUE IF NOT EXISTS 'CUSTOMER_RETURN';
ALTER TYPE "PharmacyStockTransactionType" ADD VALUE IF NOT EXISTS 'VENDOR_RETURN';
ALTER TYPE "PharmacyStockTransactionType" ADD VALUE IF NOT EXISTS 'EXPIRED_RETURN';
ALTER TYPE "PharmacyStockTransactionType" ADD VALUE IF NOT EXISTS 'DAMAGED_RETURN';

-- CreateTable
CREATE TABLE "PharmacyReturn" (
    "id" UUID NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "returnType" "PharmacyReturnType" NOT NULL,
    "status" "PharmacyReturnStatus" NOT NULL DEFAULT 'PENDING',
    "billId" UUID,
    "supplierId" UUID,
    "patientId" UUID,
    "referenceNumber" TEXT,
    "patientName" TEXT,
    "supplierName" TEXT,
    "refundType" "PharmacyRefundType",
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdBy" UUID,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PharmacyReturnItem" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "inventoryBatchId" UUID NOT NULL,
    "billItemId" UUID,
    "medicineName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "PharmacyReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacyReturn_returnNumber_key" ON "PharmacyReturn"("returnNumber");
CREATE INDEX "PharmacyReturn_returnNumber_idx" ON "PharmacyReturn"("returnNumber");
CREATE INDEX "PharmacyReturn_returnType_idx" ON "PharmacyReturn"("returnType");
CREATE INDEX "PharmacyReturn_status_idx" ON "PharmacyReturn"("status");
CREATE INDEX "PharmacyReturn_billId_idx" ON "PharmacyReturn"("billId");
CREATE INDEX "PharmacyReturn_supplierId_idx" ON "PharmacyReturn"("supplierId");
CREATE INDEX "PharmacyReturn_patientId_idx" ON "PharmacyReturn"("patientId");
CREATE INDEX "PharmacyReturn_createdAt_idx" ON "PharmacyReturn"("createdAt");

CREATE INDEX "PharmacyReturnItem_returnId_idx" ON "PharmacyReturnItem"("returnId");
CREATE INDEX "PharmacyReturnItem_medicineId_idx" ON "PharmacyReturnItem"("medicineId");
CREATE INDEX "PharmacyReturnItem_inventoryBatchId_idx" ON "PharmacyReturnItem"("inventoryBatchId");
CREATE INDEX "PharmacyReturnItem_billItemId_idx" ON "PharmacyReturnItem"("billItemId");

ALTER TABLE "PharmacyReturn" ADD CONSTRAINT "PharmacyReturn_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PharmacyBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PharmacyReturn" ADD CONSTRAINT "PharmacyReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PharmacyReturn" ADD CONSTRAINT "PharmacyReturn_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PharmacyReturnItem" ADD CONSTRAINT "PharmacyReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PharmacyReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyReturnItem" ADD CONSTRAINT "PharmacyReturnItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyReturnItem" ADD CONSTRAINT "PharmacyReturnItem_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "PharmacyInventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
