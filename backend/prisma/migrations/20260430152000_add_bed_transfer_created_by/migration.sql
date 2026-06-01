-- Add createdByUserId to BedTransfer so transfer history can show "Transferred by"
ALTER TABLE "BedTransfer"
ADD COLUMN IF NOT EXISTS "createdByUserId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BedTransfer_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "BedTransfer"
    ADD CONSTRAINT "BedTransfer_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BedTransfer_createdByUserId_idx" ON "BedTransfer"("createdByUserId");

