DROP INDEX IF EXISTS "Site_status_idx";

ALTER TABLE "Site"
  DROP COLUMN IF EXISTS "clientName",
  DROP COLUMN IF EXISTS "city",
  DROP COLUMN IF EXISTS "country",
  DROP COLUMN IF EXISTS "startDate",
  DROP COLUMN IF EXISTS "plannedEndDate",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "progressPercent";

DROP TYPE IF EXISTS "SiteStatus";
