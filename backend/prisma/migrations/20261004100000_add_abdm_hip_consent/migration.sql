-- CreateTable
CREATE TABLE "AbdmHipConsent" (
    "id" UUID NOT NULL,
    "consentId" TEXT NOT NULL,
    "abhaAddress" TEXT NOT NULL,
    "patientId" UUID,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbdmHipConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbdmHipConsent_consentId_key" ON "AbdmHipConsent"("consentId");

-- CreateIndex
CREATE INDEX "AbdmHipConsent_abhaAddress_idx" ON "AbdmHipConsent"("abhaAddress");

-- CreateIndex
CREATE INDEX "AbdmHipConsent_patientId_idx" ON "AbdmHipConsent"("patientId");
