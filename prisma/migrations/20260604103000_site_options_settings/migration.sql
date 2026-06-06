ALTER TABLE "TenantSettings"
ADD COLUMN "siteRoleOptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "clientOptions" JSONB NOT NULL DEFAULT '[]';
