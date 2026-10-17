-- CreateTable
CREATE TABLE "AbdmHiuHealthRecord" (
    "id" UUID NOT NULL,
    "transactionId" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "careContextReference" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "fhirPayload" JSONB NOT NULL,
    "sourceHipId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbdmHiuHealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbdmHiuHealthRecord_transactionId_careContextReference_key" ON "AbdmHiuHealthRecord"("transactionId", "careContextReference");

-- CreateIndex
CREATE INDEX "AbdmHiuHealthRecord_consentId_idx" ON "AbdmHiuHealthRecord"("consentId");

-- CreateIndex
CREATE INDEX "AbdmHiuHealthRecord_recordType_idx" ON "AbdmHiuHealthRecord"("recordType");
