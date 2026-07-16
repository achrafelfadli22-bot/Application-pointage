CREATE TYPE "TimesheetLineStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SITE_APPROVED', 'APPROVED', 'REJECTED');

ALTER TYPE "ApprovalEntityType" ADD VALUE IF NOT EXISTS 'TIMESHEET_LINE';

ALTER TABLE "TimesheetLine"
ADD COLUMN "approvalStatus" "TimesheetLineStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "siteApprovedById" TEXT,
ADD COLUMN "siteApprovedAt" TIMESTAMP(3),
ADD COLUMN "projectApprovedById" TEXT,
ADD COLUMN "projectApprovedAt" TIMESTAMP(3),
ADD COLUMN "rejectedById" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "TimesheetLine_approvalStatus_idx" ON "TimesheetLine"("approvalStatus");
