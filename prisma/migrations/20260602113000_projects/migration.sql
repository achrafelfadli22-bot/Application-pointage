CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SUSPENDED');

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "clientName" TEXT,
  "projectManagerId" TEXT NOT NULL,
  "startDate" DATE,
  "plannedEndDate" DATE,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Site" ADD COLUMN "projectId" TEXT;

CREATE UNIQUE INDEX "Project_tenantId_code_key" ON "Project"("tenantId", "code");
CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");
CREATE INDEX "Project_projectManagerId_idx" ON "Project"("projectManagerId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Site_projectId_idx" ON "Site"("projectId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Site" ADD CONSTRAINT "Site_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
