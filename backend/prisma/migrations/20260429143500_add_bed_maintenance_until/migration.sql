ALTER TABLE "Bed"
ADD COLUMN "maintenanceUntil" TIMESTAMP(3);

CREATE INDEX "Bed_status_maintenanceUntil_idx" ON "Bed"("status", "maintenanceUntil");

