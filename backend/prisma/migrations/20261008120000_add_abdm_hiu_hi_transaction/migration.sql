-- CreateTable
CREATE TABLE "AbdmHiuHiTransaction" (
    "id" UUID NOT NULL,
    "transactionId" TEXT,
    "consentId" TEXT NOT NULL,
    "requestId" TEXT,
    "dateFrom" TEXT,
    "dateTo" TEXT,
    "dataPushUrl" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "hipId" TEXT,
    "careContextReferences" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "resultMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbdmHiuHiTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbdmHiuHiTransaction_transactionId_key" ON "AbdmHiuHiTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "AbdmHiuHiTransaction_consentId_idx" ON "AbdmHiuHiTransaction"("consentId");

-- CreateIndex
CREATE INDEX "AbdmHiuHiTransaction_requestId_idx" ON "AbdmHiuHiTransaction"("requestId");

-- CreateIndex
CREATE INDEX "AbdmHiuHiTransaction_status_idx" ON "AbdmHiuHiTransaction"("status");
