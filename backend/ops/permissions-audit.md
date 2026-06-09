# Permissions Audit

Date: 2026-06-08

## Roles

| Role | Scope | Main rights |
| --- | --- | --- |
| `SUPER_ADMIN` | Global platform | Tenants, subscriptions, global reporting |
| `RESOURCE_MANAGER` | One tenant | Users, employees, projects, sites, settings, reports |
| `HR` | Tenant HR | Leave, balances, payroll exports, HR reports |
| `PROJECT_MANAGER` | Assigned projects | Project/site visibility, N+2 validation, project reports |
| `MANAGER` | Assigned sites/team | Site team visibility, N+1 validation, site reports |
| `EMPLOYEE` | Own account | Own attendance, own timesheets, own leave requests |

## Current Guard Model

- `JwtAuthGuard`: protects authenticated API routes.
- `TenantGuard`: enforces tenant scope.
- `RolesGuard`: enforces controller role decorators.
- Service-level scope: dashboard, employees, projects, sites, attendance, leave, and timesheets apply data-level filtering.

## Critical Rules Checked

| Area | Rule | Status |
| --- | --- | --- |
| Timesheets | Employee can create and edit own draft/reopened timesheets | OK |
| Timesheets | N+1 can edit submitted timesheets from own team | OK |
| Timesheets | Resource Manager cannot approve timesheets | OK |
| Timesheets | A user cannot approve or reject their own timesheet | OK |
| Timesheets | Owner can delete own draft timesheet only | OK |
| Timesheets | Submitted/approved/rejected timesheets cannot be deleted by owner | OK |
| Employees | Resource Manager can create tenant employees | OK |
| Employees | Resource Manager can update employee profile and account data | OK |
| Employees | Resource Manager can deactivate `EMPLOYEE` and `MANAGER` only | OK |
| Employees | Resource Manager cannot delete own account | OK |
| Projects | Resource Manager can create/update/delete projects | OK |
| Projects | Project Manager sees projects linked to them | OK |
| Sites | Resource Manager can create/update/delete sites | OK |
| Sites | Manager sees sites they manage and assigned site data | OK |
| Attendance | N+1/N+2 scoped validation exists at service level | OK |
| Leave | N+1/N+2/HR scoped validation exists at service level | OK |
| Reports | Employee export is scoped to own timesheets | OK |

## Endpoint Audit Summary

| Module | Controller-level roles | Data-level scoping |
| --- | --- | --- |
| Auth | Public login/refresh, authenticated profile | Tenant/user context built from JWT |
| Dashboard | Authenticated | Role-specific service scope |
| Employees | RM/HR/PM/Manager read, RM write/delete | `HierarchyService.managedUserIds` and tenant filter |
| Projects | RM write, tenant roles read | tenant, project manager, manager, employee assignment scope |
| Sites | RM write/delete, tenant roles read, RM/HR/Manager assign | tenant, project manager, manager, employee assignment scope |
| Attendance | tenant roles with validation roles for approve/reject | user/team/project/site scope |
| Timesheets | authenticated CRUD, validation roles for approve/reject | user/team/project/site scope |
| Leave | tenant roles with validation roles for approve/reject | user/team/project/site scope |
| Reports | tenant roles | role-based report filters |
| Settings | RM/HR read/write depending on endpoint | tenant settings only |
| Audit Log | Super Admin/RM/HR | tenant filter |

## Residual Risks

- Some role rules are enforced in services, not only decorators. This is intentional because the same endpoint can be legal or illegal depending on the target employee/site.
- Add more negative tests for attendance and leave N+1/N+2 chains when more fixture data is stable.
- Add production alerting outside the app stack because health endpoints and structured logs are now present but external monitoring must consume them.
