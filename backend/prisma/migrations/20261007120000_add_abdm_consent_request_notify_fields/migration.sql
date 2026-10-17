-- AlterTable
ALTER TABLE "AbdmConsentRequest" ADD COLUMN "consentId" TEXT;
ALTER TABLE "AbdmConsentRequest" ADD COLUMN "artefactId" TEXT;
ALTER TABLE "AbdmConsentRequest" ADD COLUMN "abhaAddress" TEXT;

-- CreateIndex
CREATE INDEX "AbdmConsentRequest_consentId_idx" ON "AbdmConsentRequest"("consentId");
