ALTER TABLE "SurgerySchedule" ADD COLUMN IF NOT EXISTS "rescheduledAt" TIMESTAMP(3);
ALTER TABLE "SurgerySchedule" ADD COLUMN IF NOT EXISTS "rescheduleReason" TEXT;
