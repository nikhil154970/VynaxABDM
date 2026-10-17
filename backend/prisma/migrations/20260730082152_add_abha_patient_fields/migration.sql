-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "abhaAddress" TEXT,
ADD COLUMN     "abhaNumber" TEXT,
ADD COLUMN     "abhaStatus" TEXT,
ADD COLUMN     "healthIdNumber" TEXT,
ADD COLUMN     "isAbhaVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phrAddress" JSONB;
