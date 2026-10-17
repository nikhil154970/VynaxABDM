-- Recovery → Reception transfer request workflow
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "transferRequestStatus" TEXT;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "transferRequestedAt" TIMESTAMP(3);
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "transferRequestedById" UUID;
ALTER TABLE "RecoveryRecord" ADD COLUMN IF NOT EXISTS "preferredWardType" TEXT;
