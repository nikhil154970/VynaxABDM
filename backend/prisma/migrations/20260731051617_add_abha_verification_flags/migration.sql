-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "aadhaarVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "abdmVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "mobileVerified" BOOLEAN NOT NULL DEFAULT false;
