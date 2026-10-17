-- CreateTable
CREATE TABLE "AbdmCareContext" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "careContextId" TEXT NOT NULL,
    "episodeType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "hiType" TEXT NOT NULL,
    "display" TEXT,
    "linkStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbdmCareContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbdmHealthDocument" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "careContextId" TEXT NOT NULL,
    "abdmCareContextId" UUID,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "hiType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbdmHealthDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbdmCareContext_careContextId_key" ON "AbdmCareContext"("careContextId");

-- CreateIndex
CREATE UNIQUE INDEX "AbdmCareContext_sourceType_sourceId_key" ON "AbdmCareContext"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AbdmCareContext_patientId_idx" ON "AbdmCareContext"("patientId");

-- CreateIndex
CREATE INDEX "AbdmCareContext_episodeType_sourceId_idx" ON "AbdmCareContext"("episodeType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AbdmHealthDocument_sourceType_sourceId_key" ON "AbdmHealthDocument"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AbdmHealthDocument_patientId_idx" ON "AbdmHealthDocument"("patientId");

-- CreateIndex
CREATE INDEX "AbdmHealthDocument_careContextId_idx" ON "AbdmHealthDocument"("careContextId");

-- CreateIndex
CREATE INDEX "AbdmHealthDocument_syncStatus_idx" ON "AbdmHealthDocument"("syncStatus");

-- AddForeignKey
ALTER TABLE "AbdmCareContext" ADD CONSTRAINT "AbdmCareContext_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbdmHealthDocument" ADD CONSTRAINT "AbdmHealthDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbdmHealthDocument" ADD CONSTRAINT "AbdmHealthDocument_abdmCareContextId_fkey" FOREIGN KEY ("abdmCareContextId") REFERENCES "AbdmCareContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;
