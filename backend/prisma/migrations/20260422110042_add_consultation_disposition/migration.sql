-- CreateEnum
CREATE TYPE "ConsultationDisposition" AS ENUM ('NORMAL', 'REFER_ADMIT');

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "disposition" "ConsultationDisposition" NOT NULL DEFAULT 'NORMAL';
