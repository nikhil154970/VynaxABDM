ALTER TABLE "Admission"
ADD COLUMN "nurseId" UUID;

CREATE INDEX "Admission_nurseId_status_idx" ON "Admission"("nurseId", "status");

ALTER TABLE "Admission"
ADD CONSTRAINT "Admission_nurseId_fkey"
FOREIGN KEY ("nurseId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

