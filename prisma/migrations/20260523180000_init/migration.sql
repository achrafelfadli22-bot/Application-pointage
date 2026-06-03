-- Initial Pointage360 schema.
-- This migration is generated from prisma/schema.prisma and is kept readable for pilot deployments.

CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SUSPENDED');
CREATE TYPE "WorkLocation" AS ENUM ('SITE', 'OFFICE', 'HOME', 'TRAVEL');
CREATE TYPE "AttendanceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED');
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED');
CREATE TYPE "BillingType" AS ENUM ('BILLABLE', 'NON_BILLABLE');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ApprovalEntityType" AS ENUM ('TIMESHEET', 'LEAVE_REQUEST', 'ATTENDANCE_PUNCH');
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "maxUsers" INTEGER NOT NULL,
  "maxSites" INTEGER NOT NULL,
  "priceMonthly" DECIMAL(10,2) NOT NULL,
  "features" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tenant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
  "subscriptionPlanId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMP(3),
  "refreshTokenHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeNumber" TEXT NOT NULL,
  "jobTitle" TEXT NOT NULL,
  "contractType" TEXT NOT NULL,
  "hireDate" DATE NOT NULL,
  "mainSiteId" TEXT,
  "annualLeaveBalance" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "hourlyRate" DECIMAL(10,2),
  "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Site" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "managerId" TEXT,
  "startDate" DATE,
  "plannedEndDate" DATE,
  "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "gpsRadiusMeters" INTEGER NOT NULL DEFAULT 150,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "roleOnSite" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendancePunch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "siteId" TEXT,
  "punchDate" DATE NOT NULL,
  "checkInAt" TIMESTAMP(3),
  "checkOutAt" TIMESTAMP(3),
  "durationMinutes" INTEGER,
  "workLocation" "WorkLocation" NOT NULL DEFAULT 'SITE',
  "checkInLatitude" DECIMAL(10,7),
  "checkInLongitude" DECIMAL(10,7),
  "checkOutLatitude" DECIMAL(10,7),
  "checkOutLongitude" DECIMAL(10,7),
  "isGpsAnomaly" BOOLEAN NOT NULL DEFAULT false,
  "employeeComment" TEXT,
  "managerComment" TEXT,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Timesheet" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimesheetLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "timesheetId" TEXT NOT NULL,
  "siteId" TEXT,
  "taskName" TEXT NOT NULL,
  "billingType" "BillingType" NOT NULL DEFAULT 'BILLABLE',
  "activity" TEXT,
  "workLocation" "WorkLocation" NOT NULL DEFAULT 'SITE',
  "placeOfWork" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimesheetLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimesheetDayEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "timesheetLineId" TEXT NOT NULL,
  "entryDate" DATE NOT NULL,
  "hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimesheetDayEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isPaid" BOOLEAN NOT NULL DEFAULT true,
  "annualAllowanceDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveBalance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "openingBalance" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "accruedDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "usedDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "pendingDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "remainingDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "durationDays" DECIMAL(6,2) NOT NULL,
  "startHalfDay" BOOLEAN NOT NULL DEFAULT false,
  "endHalfDay" BOOLEAN NOT NULL DEFAULT false,
  "comment" TEXT,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalAction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "entityType" "ApprovalEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "actionById" TEXT NOT NULL,
  "oldStatus" TEXT NOT NULL,
  "newStatus" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Holiday" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "country" TEXT NOT NULL,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");
CREATE UNIQUE INDEX "EmployeeProfile_tenantId_employeeNumber_key" ON "EmployeeProfile"("tenantId", "employeeNumber");
CREATE UNIQUE INDEX "Site_tenantId_code_key" ON "Site"("tenantId", "code");
CREATE UNIQUE INDEX "Timesheet_tenantId_userId_periodStart_periodEnd_key" ON "Timesheet"("tenantId", "userId", "periodStart", "periodEnd");
CREATE UNIQUE INDEX "TimesheetDayEntry_tenantId_timesheetLineId_entryDate_key" ON "TimesheetDayEntry"("tenantId", "timesheetLineId", "entryDate");
CREATE UNIQUE INDEX "LeaveType_tenantId_code_key" ON "LeaveType"("tenantId", "code");
CREATE UNIQUE INDEX "LeaveBalance_tenantId_userId_leaveTypeId_year_key" ON "LeaveBalance"("tenantId", "userId", "leaveTypeId", "year");
CREATE UNIQUE INDEX "Holiday_tenantId_name_date_key" ON "Holiday"("tenantId", "name", "date");

CREATE INDEX "Tenant_subscriptionPlanId_idx" ON "Tenant"("subscriptionPlanId");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "EmployeeProfile_tenantId_idx" ON "EmployeeProfile"("tenantId");
CREATE INDEX "EmployeeProfile_userId_idx" ON "EmployeeProfile"("userId");
CREATE INDEX "EmployeeProfile_mainSiteId_idx" ON "EmployeeProfile"("mainSiteId");
CREATE INDEX "EmployeeProfile_status_idx" ON "EmployeeProfile"("status");
CREATE INDEX "Site_tenantId_idx" ON "Site"("tenantId");
CREATE INDEX "Site_managerId_idx" ON "Site"("managerId");
CREATE INDEX "Site_status_idx" ON "Site"("status");
CREATE INDEX "SiteAssignment_tenantId_idx" ON "SiteAssignment"("tenantId");
CREATE INDEX "SiteAssignment_siteId_idx" ON "SiteAssignment"("siteId");
CREATE INDEX "SiteAssignment_userId_idx" ON "SiteAssignment"("userId");
CREATE INDEX "SiteAssignment_startDate_idx" ON "SiteAssignment"("startDate");
CREATE INDEX "SiteAssignment_endDate_idx" ON "SiteAssignment"("endDate");
CREATE INDEX "AttendancePunch_tenantId_idx" ON "AttendancePunch"("tenantId");
CREATE INDEX "AttendancePunch_userId_idx" ON "AttendancePunch"("userId");
CREATE INDEX "AttendancePunch_siteId_idx" ON "AttendancePunch"("siteId");
CREATE INDEX "AttendancePunch_status_idx" ON "AttendancePunch"("status");
CREATE INDEX "AttendancePunch_punchDate_idx" ON "AttendancePunch"("punchDate");
CREATE INDEX "Timesheet_tenantId_idx" ON "Timesheet"("tenantId");
CREATE INDEX "Timesheet_userId_idx" ON "Timesheet"("userId");
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");
CREATE INDEX "Timesheet_periodStart_idx" ON "Timesheet"("periodStart");
CREATE INDEX "Timesheet_periodEnd_idx" ON "Timesheet"("periodEnd");
CREATE INDEX "TimesheetLine_tenantId_idx" ON "TimesheetLine"("tenantId");
CREATE INDEX "TimesheetLine_timesheetId_idx" ON "TimesheetLine"("timesheetId");
CREATE INDEX "TimesheetLine_siteId_idx" ON "TimesheetLine"("siteId");
CREATE INDEX "TimesheetDayEntry_tenantId_idx" ON "TimesheetDayEntry"("tenantId");
CREATE INDEX "TimesheetDayEntry_timesheetLineId_idx" ON "TimesheetDayEntry"("timesheetLineId");
CREATE INDEX "TimesheetDayEntry_entryDate_idx" ON "TimesheetDayEntry"("entryDate");
CREATE INDEX "LeaveType_tenantId_idx" ON "LeaveType"("tenantId");
CREATE INDEX "LeaveType_status_idx" ON "LeaveType"("status");
CREATE INDEX "LeaveBalance_tenantId_idx" ON "LeaveBalance"("tenantId");
CREATE INDEX "LeaveBalance_userId_idx" ON "LeaveBalance"("userId");
CREATE INDEX "LeaveBalance_leaveTypeId_idx" ON "LeaveBalance"("leaveTypeId");
CREATE INDEX "LeaveRequest_tenantId_idx" ON "LeaveRequest"("tenantId");
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");
CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");
CREATE INDEX "LeaveRequest_endDate_idx" ON "LeaveRequest"("endDate");
CREATE INDEX "ApprovalAction_tenantId_idx" ON "ApprovalAction"("tenantId");
CREATE INDEX "ApprovalAction_entityType_entityId_idx" ON "ApprovalAction"("entityType", "entityId");
CREATE INDEX "ApprovalAction_actionById_idx" ON "ApprovalAction"("actionById");
CREATE INDEX "Holiday_tenantId_idx" ON "Holiday"("tenantId");
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_mainSiteId_fkey" FOREIGN KEY ("mainSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Site" ADD CONSTRAINT "Site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Site" ADD CONSTRAINT "Site_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SiteAssignment" ADD CONSTRAINT "SiteAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteAssignment" ADD CONSTRAINT "SiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteAssignment" ADD CONSTRAINT "SiteAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimesheetLine" ADD CONSTRAINT "TimesheetLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimesheetLine" ADD CONSTRAINT "TimesheetLine_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimesheetLine" ADD CONSTRAINT "TimesheetLine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimesheetDayEntry" ADD CONSTRAINT "TimesheetDayEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimesheetDayEntry" ADD CONSTRAINT "TimesheetDayEntry_timesheetLineId_fkey" FOREIGN KEY ("timesheetLineId") REFERENCES "TimesheetLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
