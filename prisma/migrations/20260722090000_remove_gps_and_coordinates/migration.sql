ALTER TABLE "Site"
  DROP COLUMN IF EXISTS "latitude",
  DROP COLUMN IF EXISTS "longitude",
  DROP COLUMN IF EXISTS "gpsRadiusMeters";

ALTER TABLE "AttendancePunch"
  DROP COLUMN IF EXISTS "checkInLatitude",
  DROP COLUMN IF EXISTS "checkInLongitude",
  DROP COLUMN IF EXISTS "checkOutLatitude",
  DROP COLUMN IF EXISTS "checkOutLongitude",
  DROP COLUMN IF EXISTS "isGpsAnomaly";

ALTER TABLE "TenantSettings"
  DROP COLUMN IF EXISTS "gpsToleranceMeters";
