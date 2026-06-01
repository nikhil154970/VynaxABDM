-- Doctor can suggest ward type when referring for IPD admit
ALTER TABLE "Consultation"
ADD COLUMN IF NOT EXISTS "suggestedWardType" "WardType";

CREATE INDEX IF NOT EXISTS "Consultation_disposition_createdAt_idx"
ON "Consultation"("disposition", "createdAt");

