-- CreateTable
CREATE TABLE "AbdmConsentRequest" (
    "id" UUID NOT NULL,
    "consentRequestId" TEXT NOT NULL,
    "requestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbdmConsentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbdmConsentRequest_consentRequestId_key" ON "AbdmConsentRequest"("consentRequestId");

-- CreateIndex
CREATE INDEX "AbdmConsentRequest_requestId_idx" ON "AbdmConsentRequest"("requestId");

-- CreateIndex
CREATE INDEX "AbdmConsentRequest_status_idx" ON "AbdmConsentRequest"("status");
