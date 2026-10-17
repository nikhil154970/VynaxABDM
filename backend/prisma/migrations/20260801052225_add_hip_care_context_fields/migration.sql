-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "careContextId" TEXT,
ADD COLUMN     "careContextStatus" TEXT,
ADD COLUMN     "hipLinkRequestId" TEXT,
ADD COLUMN     "hipLinked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hipReferenceNumber" TEXT,
ADD COLUMN     "linkedAt" TIMESTAMP(3),
ADD COLUMN     "syncStatus" TEXT;
