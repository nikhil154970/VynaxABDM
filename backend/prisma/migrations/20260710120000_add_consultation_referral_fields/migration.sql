-- Referral fields on Consultation (department / doctor)
ALTER TYPE "ConsultationDisposition" ADD VALUE IF NOT EXISTS 'REFER_DEPT';

ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "referredDepartment" TEXT;
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "referredDoctorId" UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Consultation_referredDoctorId_fkey'
  ) THEN
    ALTER TABLE "Consultation"
      ADD CONSTRAINT "Consultation_referredDoctorId_fkey"
      FOREIGN KEY ("referredDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
