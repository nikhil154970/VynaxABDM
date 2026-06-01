/*
  Warnings:

  - A unique constraint covering the columns `[opdSeq]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[opdNumber]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[regSeq]` on the table `Patient` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[registrationNumber]` on the table `Patient` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "opdNumber" TEXT,
ADD COLUMN     "opdSeq" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "regSeq" SERIAL NOT NULL,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "weightKg" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_opdSeq_key" ON "Appointment"("opdSeq");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_opdNumber_key" ON "Appointment"("opdNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_regSeq_key" ON "Patient"("regSeq");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_registrationNumber_key" ON "Patient"("registrationNumber");
