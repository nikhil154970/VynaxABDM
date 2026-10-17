-- AlterEnum: add IN_RECOVERY to OtRequestStatus
ALTER TYPE "OtRequestStatus" ADD VALUE IF NOT EXISTS 'IN_RECOVERY';
