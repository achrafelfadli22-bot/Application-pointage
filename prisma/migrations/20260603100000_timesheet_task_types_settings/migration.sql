ALTER TABLE "TenantSettings"
ADD COLUMN "timesheetTaskTypes" JSONB NOT NULL DEFAULT '[]';
