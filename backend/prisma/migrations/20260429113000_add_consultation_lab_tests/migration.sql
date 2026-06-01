-- Add optional lab test JSON payload to doctor consultations.
ALTER TABLE "Consultation"
ADD COLUMN "labTests" JSONB;
