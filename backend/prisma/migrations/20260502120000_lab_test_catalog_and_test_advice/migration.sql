-- CreateTable
CREATE TABLE "LabTest" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAdvice" (
    "id" SERIAL NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "consultationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestAdvice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAdviceItem" (
    "id" SERIAL NOT NULL,
    "adviceId" INTEGER NOT NULL,
    "testId" INTEGER NOT NULL,

    CONSTRAINT "TestAdviceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabTest_isActive_idx" ON "LabTest"("isActive");

-- CreateIndex
CREATE INDEX "LabTest_category_idx" ON "LabTest"("category");

-- CreateIndex
CREATE INDEX "TestAdvice_patientId_createdAt_idx" ON "TestAdvice"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "TestAdvice_doctorId_createdAt_idx" ON "TestAdvice"("doctorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestAdvice_consultationId_key" ON "TestAdvice"("consultationId");

-- CreateIndex
CREATE INDEX "TestAdviceItem_adviceId_idx" ON "TestAdviceItem"("adviceId");

-- CreateIndex
CREATE INDEX "TestAdviceItem_testId_idx" ON "TestAdviceItem"("testId");

-- AddForeignKey
ALTER TABLE "TestAdvice" ADD CONSTRAINT "TestAdvice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAdvice" ADD CONSTRAINT "TestAdvice_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAdvice" ADD CONSTRAINT "TestAdvice_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAdviceItem" ADD CONSTRAINT "TestAdviceItem_adviceId_fkey" FOREIGN KEY ("adviceId") REFERENCES "TestAdvice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAdviceItem" ADD CONSTRAINT "TestAdviceItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
