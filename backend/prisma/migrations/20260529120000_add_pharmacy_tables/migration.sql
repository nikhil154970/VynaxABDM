-- CreateEnum
CREATE TYPE "PharmacySupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PharmacyCatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PharmacyInventoryBatchStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PharmacyStockTransactionType" AS ENUM ('GRN_IN', 'SALE_OUT', 'ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT');

-- CreateEnum
CREATE TYPE "PharmacyGrnReceiptStatus" AS ENUM ('Full', 'Partial');

-- CreateTable
CREATE TABLE "PharmacySupplier" (
    "id" UUID NOT NULL,
    "supplierName" TEXT NOT NULL,
    "companyName" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "gstNumber" TEXT NOT NULL,
    "drugLicenseNumber" TEXT,
    "panNumber" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "creditLimit" DECIMAL(14,2),
    "paymentTerms" TEXT,
    "notes" TEXT,
    "status" "PharmacySupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "outstandingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPurchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacySupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyMedicine" (
    "id" UUID NOT NULL,
    "medicineName" TEXT NOT NULL,
    "genericName" TEXT,
    "brandName" TEXT,
    "category" TEXT NOT NULL,
    "dosageForm" TEXT,
    "strength" TEXT,
    "manufacturer" TEXT,
    "hsnCode" TEXT,
    "gstPercentage" INTEGER NOT NULL,
    "barcode" TEXT,
    "description" TEXT,
    "defaultMRP" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "defaultPurchasePrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "defaultSellingPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "prescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
    "expiryApplicable" BOOLEAN NOT NULL DEFAULT true,
    "status" "PharmacyCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyMedicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyPurchaseOrder" (
    "id" UUID NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierName" TEXT NOT NULL,
    "subTotal" DECIMAL(14,2) NOT NULL,
    "gstAmount" DECIMAL(14,2) NOT NULL,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyPurchaseOrderItem" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "medicineName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "gstPercentage" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PharmacyPurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyGrn" (
    "id" UUID NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierName" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "subTotal" DECIMAL(14,2) NOT NULL,
    "gstAmount" DECIMAL(14,2) NOT NULL,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "remarks" TEXT,
    "receiptStatus" "PharmacyGrnReceiptStatus" NOT NULL DEFAULT 'Partial',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyGrn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyGrnItem" (
    "id" UUID NOT NULL,
    "grnId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "medicineName" TEXT NOT NULL,
    "orderedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "freeQty" INTEGER NOT NULL DEFAULT 0,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "mrp" DECIMAL(14,2) NOT NULL,
    "gstPercentage" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PharmacyGrnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyInventoryBatch" (
    "id" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "medicineName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "mrp" DECIMAL(14,2) NOT NULL,
    "qty" INTEGER NOT NULL,
    "availableQty" INTEGER NOT NULL,
    "gstPercentage" INTEGER NOT NULL,
    "supplierId" UUID NOT NULL,
    "grnId" UUID NOT NULL,
    "status" "PharmacyInventoryBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyInventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyStockTransaction" (
    "id" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "type" "PharmacyStockTransactionType" NOT NULL,
    "qtyIn" INTEGER NOT NULL DEFAULT 0,
    "qtyOut" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyStockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PharmacySupplier_supplierName_idx" ON "PharmacySupplier"("supplierName");

-- CreateIndex
CREATE INDEX "PharmacySupplier_gstNumber_idx" ON "PharmacySupplier"("gstNumber");

-- CreateIndex
CREATE INDEX "PharmacySupplier_phone_idx" ON "PharmacySupplier"("phone");

-- CreateIndex
CREATE INDEX "PharmacySupplier_status_idx" ON "PharmacySupplier"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyMedicine_barcode_key" ON "PharmacyMedicine"("barcode");

-- CreateIndex
CREATE INDEX "PharmacyMedicine_medicineName_idx" ON "PharmacyMedicine"("medicineName");

-- CreateIndex
CREATE INDEX "PharmacyMedicine_category_idx" ON "PharmacyMedicine"("category");

-- CreateIndex
CREATE INDEX "PharmacyMedicine_status_idx" ON "PharmacyMedicine"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyPurchaseOrder_poNumber_key" ON "PharmacyPurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseOrder_status_idx" ON "PharmacyPurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseOrder_supplierName_idx" ON "PharmacyPurchaseOrder"("supplierName");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseOrder_createdAt_idx" ON "PharmacyPurchaseOrder"("createdAt");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseOrderItem_purchaseOrderId_idx" ON "PharmacyPurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseOrderItem_medicineId_idx" ON "PharmacyPurchaseOrderItem"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyGrn_grnNumber_key" ON "PharmacyGrn"("grnNumber");

-- CreateIndex
CREATE INDEX "PharmacyGrn_status_idx" ON "PharmacyGrn"("status");

-- CreateIndex
CREATE INDEX "PharmacyGrn_poNumber_idx" ON "PharmacyGrn"("poNumber");

-- CreateIndex
CREATE INDEX "PharmacyGrn_receivedDate_idx" ON "PharmacyGrn"("receivedDate");

-- CreateIndex
CREATE INDEX "PharmacyGrn_createdAt_idx" ON "PharmacyGrn"("createdAt");

-- CreateIndex
CREATE INDEX "PharmacyGrnItem_grnId_idx" ON "PharmacyGrnItem"("grnId");

-- CreateIndex
CREATE INDEX "PharmacyGrnItem_medicineId_idx" ON "PharmacyGrnItem"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacyInventoryBatch_medicineId_idx" ON "PharmacyInventoryBatch"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacyInventoryBatch_batchNumber_idx" ON "PharmacyInventoryBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "PharmacyInventoryBatch_expiryDate_idx" ON "PharmacyInventoryBatch"("expiryDate");

-- CreateIndex
CREATE INDEX "PharmacyInventoryBatch_status_idx" ON "PharmacyInventoryBatch"("status");

-- CreateIndex
CREATE INDEX "PharmacyInventoryBatch_medicineId_batchNumber_idx" ON "PharmacyInventoryBatch"("medicineId", "batchNumber");

-- CreateIndex
CREATE INDEX "PharmacyStockTransaction_medicineId_idx" ON "PharmacyStockTransaction"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacyStockTransaction_batchId_idx" ON "PharmacyStockTransaction"("batchId");

-- CreateIndex
CREATE INDEX "PharmacyStockTransaction_type_idx" ON "PharmacyStockTransaction"("type");

-- CreateIndex
CREATE INDEX "PharmacyStockTransaction_createdAt_idx" ON "PharmacyStockTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "PharmacySupplier" ADD CONSTRAINT "PharmacySupplier_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseOrder" ADD CONSTRAINT "PharmacyPurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseOrderItem" ADD CONSTRAINT "PharmacyPurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PharmacyPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseOrderItem" ADD CONSTRAINT "PharmacyPurchaseOrderItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyGrn" ADD CONSTRAINT "PharmacyGrn_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PharmacyPurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyGrn" ADD CONSTRAINT "PharmacyGrn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyGrnItem" ADD CONSTRAINT "PharmacyGrnItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "PharmacyGrn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyGrnItem" ADD CONSTRAINT "PharmacyGrnItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyInventoryBatch" ADD CONSTRAINT "PharmacyInventoryBatch_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyInventoryBatch" ADD CONSTRAINT "PharmacyInventoryBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyInventoryBatch" ADD CONSTRAINT "PharmacyInventoryBatch_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "PharmacyGrn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockTransaction" ADD CONSTRAINT "PharmacyStockTransaction_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockTransaction" ADD CONSTRAINT "PharmacyStockTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyInventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
