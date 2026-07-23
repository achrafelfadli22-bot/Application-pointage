CREATE TYPE "PlanningStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "Planning" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "PlanningStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Planning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanningLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "activity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanningLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanningDayEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planningLineId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanningDayEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Planning_tenantId_createdById_periodStart_periodEnd_key" ON "Planning"("tenantId", "createdById", "periodStart", "periodEnd");
CREATE INDEX "Planning_tenantId_idx" ON "Planning"("tenantId");
CREATE INDEX "Planning_createdById_idx" ON "Planning"("createdById");
CREATE INDEX "Planning_status_idx" ON "Planning"("status");
CREATE INDEX "Planning_periodStart_idx" ON "Planning"("periodStart");
CREATE INDEX "Planning_periodEnd_idx" ON "Planning"("periodEnd");
CREATE INDEX "PlanningLine_tenantId_idx" ON "PlanningLine"("tenantId");
CREATE INDEX "PlanningLine_planningId_idx" ON "PlanningLine"("planningId");
CREATE INDEX "PlanningLine_userId_idx" ON "PlanningLine"("userId");
CREATE INDEX "PlanningLine_siteId_idx" ON "PlanningLine"("siteId");
CREATE UNIQUE INDEX "PlanningDayEntry_tenantId_planningLineId_entryDate_key" ON "PlanningDayEntry"("tenantId", "planningLineId", "entryDate");
CREATE INDEX "PlanningDayEntry_tenantId_idx" ON "PlanningDayEntry"("tenantId");
CREATE INDEX "PlanningDayEntry_planningLineId_idx" ON "PlanningDayEntry"("planningLineId");
CREATE INDEX "PlanningDayEntry_entryDate_idx" ON "PlanningDayEntry"("entryDate");

ALTER TABLE "Planning" ADD CONSTRAINT "Planning_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningLine" ADD CONSTRAINT "PlanningLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningLine" ADD CONSTRAINT "PlanningLine_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningLine" ADD CONSTRAINT "PlanningLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningLine" ADD CONSTRAINT "PlanningLine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningDayEntry" ADD CONSTRAINT "PlanningDayEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningDayEntry" ADD CONSTRAINT "PlanningDayEntry_planningLineId_fkey" FOREIGN KEY ("planningLineId") REFERENCES "PlanningLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
