import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType, Document, Footer, Header, HeadingLevel, Packer, PageNumber,
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  convertInchesToTwip, ImportedXmlComponent,
} from "docx";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("Usage: node create.js /absolute/path/output.docx");

const outputDir = path.dirname(outputPath);
fs.mkdirSync(outputDir, { recursive: true });

const font = { name: "Calibri", eastAsia: "SimSun" };
const run = (text, options = {}) => new TextRun({ text, font, size: 22, ...options });
const para = (children, options = {}) => new Paragraph({
  spacing: { after: 120, line: 280 },
  ...options,
  children: Array.isArray(children) ? children : [children],
});

const p = (text, opts = {}) => para(run(text), { indent: { firstLine: convertInchesToTwip(0.25) }, ...opts });
const h1 = (text) => para(run(text, { bold: true, size: 32, color: "1F4E79" }), { heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 160 } });
const h2 = (text) => para(run(text, { bold: true, size: 26, color: "2E75B5" }), { heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 } });
const h3 = (text) => para(run(text, { bold: true, size: 24, color: "5B9BD5" }), { heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });
const bullet = (text) => para([run("\u2022 ", { bold: true }), run(text)], { indent: { left: convertInchesToTwip(0.3) } });

const xmlEscape = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const toc = (entries) => {
  const cached = entries.map(({ title, level, page }) => {
    const indent = Math.max(0, level - 1) * 360;
    return `<w:p><w:pPr><w:pStyle w:val="TOC${level}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9000"/></w:tabs><w:ind w:left="${indent}"/></w:pPr><w:r><w:t>${xmlEscape(title)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>${page}</w:t></w:r></w:p>`;
  }).join("");
  return ImportedXmlComponent.fromXmlString(`<w:sdt xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:sdtPr><w:alias w:val="Table of Contents"/></w:sdtPr><w:sdtContent><w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/><w:instrText xml:space="preserve"> TOC \\o &quot;1-3&quot; \\h \\z \\u </w:instrText><w:fldChar w:fldCharType="separate"/></w:r></w:p>${cached}<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:sdtContent></w:sdt>`).root[0];
};

const cell = (text, opts = {}) => new TableCell({
  children: [para(run(text, { size: 20 }))],
  margins: { top: 80, bottom: 80, left: 100, right: 100 },
  ...opts,
});

const headerCell = (text, w) => cell(text, { shading: { type: ShadingType.CLEAR, fill: "D9E2F3" }, width: { size: w, type: WidthType.DXA } });

const makeTable = (headers, rows, widths) => {
  const headerRow = new TableRow({ children: headers.map((h, i) => headerCell(h, widths[i])) });
  const dataRows = rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, { width: { size: widths[i], type: WidthType.DXA } })) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths, rows: [headerRow, ...dataRows] });
};

const sections = [];

// Title Page
sections.push({
  title: "Pointage360 Project Evaluation",
  level: 1,
  page: 1,
});

// Executive Summary
sections.push({ title: "1. Executive Summary", level: 1, page: 2 });
sections.push({ title: "2. Architecture & Stack", level: 1, page: 3 });
sections.push({ title: "2.1 Monorepo Structure", level: 2, page: 3 });
sections.push({ title: "2.2 Backend (NestJS)", level: 2, page: 3 });
sections.push({ title: "2.3 Frontend (Next.js)", level: 2, page: 4 });
sections.push({ title: "2.4 Database (Prisma + PostgreSQL)", level: 2, page: 4 });
sections.push({ title: "3. Security Assessment", level: 1, page: 5 });
sections.push({ title: "3.1 Authentication & Authorization", level: 2, page: 5 });
sections.push({ title: "3.2 Infrastructure Security", level: 2, page: 6 });
sections.push({ title: "3.4 Security Concerns", level: 2, page: 6 });
sections.push({ title: "4. Code Quality", level: 1, page: 7 });
sections.push({ title: "5. Feature Completeness", level: 1, page: 8 });
sections.push({ title: "6. Testing", level: 1, page: 9 });
sections.push({ title: "7. DevOps & Deployment", level: 1, page: 10 });
sections.push({ title: "8. Performance & Scalability", level: 1, page: 11 });
sections.push({ title: "9. Documentation", level: 1, page: 11 });
sections.push({ title: "10. Strengths", level: 1, page: 12 });
sections.push({ title: "11. Weaknesses & Risks", level: 1, page: 12 });
sections.push({ title: "12. Recommendations", level: 1, page: 13 });
sections.push({ title: "13. Grading Matrix", level: 1, page: 14 });
sections.push({ title: "14. Conclusion", level: 1, page: 14 });

const children = [];

// Title
children.push(para(run("Pointage360", { bold: true, size: 56, color: "1F4E79" }), { alignment: AlignmentType.CENTER, spacing: { before: 2000, after: 200 } }));
children.push(para(run("Project Evaluation Report", { size: 32, color: "2E75B5" }), { alignment: AlignmentType.CENTER, spacing: { after: 400 } }));
children.push(para(run("SaaS B2B Multi-Tenant Time Tracking Platform", { size: 24, italics: true }), { alignment: AlignmentType.CENTER, spacing: { after: 600 } }));
children.push(para(run("Version 0.2  |  June 27, 2026", { size: 20 }), { alignment: AlignmentType.CENTER }));
children.push(para(run("Overall Grade: A- (Strong production candidate with minor gaps)", { bold: true, size: 24, color: "C55A11" }), { alignment: AlignmentType.CENTER, spacing: { before: 600 } }));

// TOC
children.push(h1("Table of Contents"));
children.push(toc(sections));

// 1. Executive Summary
children.push(h1("1. Executive Summary"));
children.push(p("Pointage360 is a well-structured, production-oriented SaaS platform for construction and field-work companies to manage employee attendance, timesheets, leave requests, and site assignments. The codebase demonstrates mature architectural decisions, strong separation of concerns, and thoughtful security practices. It is positioned as an internal pilot with a clear evolution path toward a multi-tenant commercial product."));
children.push(p("The project achieves an overall grade of A- (85.5/100), reflecting excellent architecture and security, good feature completeness, but gaps in testing coverage, observability, and CI/CD maturity."));

// 2. Architecture
children.push(h1("2. Architecture & Stack Evaluation"));

children.push(h2("2.1 Monorepo Structure"));
children.push(makeTable(
  ["Aspect", "Rating", "Notes"],
  [
    ["pnpm workspaces + Turborepo", "Excellent", "Proper package isolation with shared config, types, UI packages"],
    ["Boundary enforcement", "Excellent", "Custom arch:check script prevents frontend->backend imports"],
    ["Build orchestration", "Good", "turbo.json + unified pnpm commands"],
  ],
  [3000, 1800, 5000]
));

children.push(h2("2.2 Backend (NestJS)"));
children.push(makeTable(
  ["Aspect", "Rating", "Notes"],
  [
    ["Modular design", "Excellent", "Clean feature modules: Auth, Attendance, Timesheets, Leave, Reports, Settings"],
    ["Dependency injection", "Excellent", "Proper constructor injection throughout"],
    ["Repository pattern", "Good", "Some services use repositories, not all modules"],
    ["DTO validation", "Excellent", "class-validator + whitelist, transform, forbidNonWhitelisted"],
    ["Swagger/OpenAPI", "Good", "Bearer auth, conditional disable in production"],
    ["API versioning", "Missing", "No /api/v1/ prefix for future compatibility"],
  ],
  [3000, 1800, 5000]
));

children.push(h2("2.3 Frontend (Next.js)"));
children.push(makeTable(
  ["Aspect", "Rating", "Notes"],
  [
    ["App Router", "Good", "Modern Next.js 15 with proper layout hierarchy"],
    ["State management", "Good", "Custom useApiData hook with refresh capability"],
    ["Component architecture", "Good", "Clear separation: domain/, layout/, ui/ components"],
    ["API client", "Excellent", "Centralized with auto token refresh, tenant suspension redirect"],
    ["Middleware auth", "Good", "Cookie-based guard with next redirect preservation"],
    ["Tailwind + shadcn/ui", "Good", "Modern styling; note Tailwind v4 postcss with v3 core mismatch"],
  ],
  [3000, 1800, 5000]
));

children.push(h2("2.4 Database (Prisma + PostgreSQL)"));
children.push(makeTable(
  ["Aspect", "Rating", "Notes"],
  [
    ["Schema design", "Excellent", "16 models, proper enums, indexes, soft deletes (deletedAt)"],
    ["Multi-tenant", "Excellent", "tenantId on every business model; TenantGuard enforces isolation"],
    ["Relations", "Excellent", "Proper onDelete behaviors throughout"],
    ["Indexes", "Good", "Strategic indexes; could add composites for common queries"],
    ["Soft deletes", "Good", "deletedAt on User, Tenant, Project, Site"],
  ],
  [3000, 1800, 5000]
));
children.push(p("Schema models: SubscriptionPlan, Tenant, User, EmployeeProfile, Project, Site, SiteAssignment, AttendancePunch, Timesheet, TimesheetLine, TimesheetDayEntry, LeaveType, LeaveBalance, LeaveRequest, ApprovalAction, Holiday, AuditLog, Notification, TenantSettings — 19 entities covering the full domain."));

// 3. Security
children.push(h1("3. Security Assessment"));

children.push(h2("3.1 Authentication & Authorization"));
children.push(makeTable(
  ["Control", "Status", "Notes"],
  [
    ["JWT access + refresh tokens", "Implemented", "Separate secrets, configurable expiry (15min / 7d)"],
    ["Refresh token rotation", "Implemented", "Hash stored in DB, rotated on every refresh"],
    ["Bcrypt password hashing", "Implemented", "Cost factor 12 for passwords, 10 for reset tokens"],
    ["Password policy", "Implemented", "12+ chars, mixed case, digit, special char"],
    ["Forgot password flow", "Implemented", "Secure 32-byte random token, 1-hour expiry, anti-enumeration"],
    ["Reset invalidates sessions", "Implemented", "refreshTokenHash cleared on reset"],
    ["RBAC", "Implemented", "6 roles with permission strings; RolesGuard + @Roles() decorator"],
    ["Tenant isolation", "Implemented", "TenantGuard rejects suspended tenants; cached in Redis"],
    ["Rate limiting", "Implemented", "@nestjs/throttler: 10 req/s short, 100 req/min medium"],
    ["CORS", "Implemented", "Configurable WEB_ORIGIN with credentials"],
  ],
  [3500, 1800, 4500]
));

children.push(h2("3.2 Infrastructure Security"));
children.push(makeTable(
  ["Control", "Status", "Notes"],
  [
    ["Production env validation", "Excellent", "Custom validateEnv rejects weak secrets, placeholder values, insecure origins"],
    ["Docker secrets", "Good", ".env.production referenced; no hardcoded secrets in images"],
    ["MinIO/S3", "Implemented", "Document storage with presigned URLs (1-hour expiry)"],
    ["Health checks", "Implemented", "/health and /health/live with DB, Redis, MinIO dependency checks"],
  ],
  [3500, 1800, 4500]
));

children.push(h2("3.3 Security Concerns"));
children.push(makeTable(
  ["Risk", "Severity", "Details"],
  [
    ["Token in localStorage", "Medium", "Access token in localStorage is XSS-exposed; use httpOnly cookies"],
    ["No 2FA/MFA", "Medium", "Not implemented; consider for sensitive HR/Admin roles"],
    ["No OAuth/SAML SSO", "Low", "Not required for initial pilot; roadmap consideration"],
    ["CSP for Swagger permissive", "Low", "unsafe-inline allowed for /api/docs; acceptable for dev"],
    ["No API request signing", "Low", "Not critical for current threat model"],
    ["Session cookie boolean-only", "Medium", "pointage360.auth=1 is a simple flag; token in localStorage"],
  ],
  [3500, 1500, 4800]
));

// 4. Code Quality
children.push(h1("4. Code Quality"));
children.push(p("TypeScript strict typing is well-applied with Prisma-generated types, custom DTOs, and service types. ESLint flat config and Prettier are configured. The codebase follows consistent patterns: DTOs with validation, Service/Controller/Repository layering, audit logging on every mutation, approval actions on state transitions, soft deletes, and notifications on approval events."));
children.push(p("Error handling uses a global HttpExceptionFilter with structured envelope responses ({ success, data, error }) and a ResponseInterceptor for consistency. The frontend API client surfaces errors with French messages and redirects on tenant suspension."));

// 5. Feature Completeness
children.push(h1("5. Feature Completeness"));
children.push(makeTable(
  ["Module", "Status", "Quality"],
  [
    ["Authentication", "Complete", "Login, refresh, logout, forgot/reset password, profile, password change"],
    ["Multi-tenant", "Complete", "Tenant CRUD, subscription plans, suspension, slug-based routing"],
    ["User Management", "Complete", "CRUD, role assignment, soft delete"],
    ["Employee Profiles", "Complete", "Employee number, job title, contract, hire date, leave balance"],
    ["Projects", "Complete", "CRUD, project manager assignment, status tracking"],
    ["Sites (Sites)", "Complete", "CRUD, GPS coordinates, radius, manager assignment, progress"],
    ["Site Assignments", "Complete", "Employee-Site assignments with date ranges and roles"],
    ["Attendance (Pointage)", "Complete", "Check-in/out, GPS validation, anomaly detection, approval workflow"],
    ["Timesheets", "Complete", "Period-based, billable/non-billable, submission/approval/rejection/reopen"],
    ["Leave Requests", "Complete", "Multi-day, half-day, attachments, approval workflow, balance tracking"],
    ["Leave Types", "Complete", "Custom per tenant, paid/unpaid, allowance, approval requirement"],
    ["Holidays", "Complete", "Per tenant, recurring support, country-specific"],
    ["Reports", "Complete", "Aggregated metrics: hours, overtime, billable, leave days, holidays"],
    ["Settings", "Complete", "Company, holidays, leave types, timesheet config, attendance config, site options"],
    ["Notifications", "Complete", "In-app notifications, mark read/read-all"],
    ["Audit Logs", "Complete", "Every action logged with user, entity, metadata, IP, user agent"],
    ["Dashboard", "Complete", "Summary endpoint with aggregated stats"],
    ["Exports", "Complete", "BullMQ CSV exports to MinIO with presigned URLs"],
    ["Email", "Complete", "5 transactional templates (Nodemailer), best-effort async delivery"],
    ["BullMQ Workers", "Complete", "4 processors: exports, notifications, reminders, reports"],
    ["File Upload", "Complete", "MinIO/S3-compatible, leave attachment support"],
  ],
  [2800, 1500, 5500]
));

children.push(p("Workflow state machines: Timesheet (DRAFT -> SUBMITTED -> N1_APPROVED -> APPROVED), Leave Request (DRAFT -> SUBMITTED -> APPROVED/REJECTED/CANCELLED), Attendance (same pattern). All transitions enforce proper guard logic with self-approval prevention and hierarchy checks."));

// 6. Testing
children.push(h1("6. Testing"));
children.push(makeTable(
  ["Test Type", "Status", "Quality"],
  [
    ["Unit tests", "Missing", "No Jest/Supertest unit tests for services/controllers"],
    ["API critical tests", "Implemented", "660-line comprehensive Node.js test runner covering health, auth, hierarchy, workflows, cleanup"],
    ["E2E tests (Playwright)", "Implemented", "5 critical UI flows: auth redirect, login, dashboard, timesheets, filters, modal"],
    ["Architecture tests", "Implemented", "check-boundaries.ts enforces frontend/backend separation"],
    ["CI/CD", "Implemented", "GitHub Actions with Postgres + Redis services, typecheck, build"],
  ],
  [3000, 1800, 5000]
));
children.push(p("Test gaps: No unit tests for individual services; no load/performance tests; no security tests (SAST/DAST); E2E coverage limited to happy-path; no contract/API schema tests."));

// 7. DevOps
children.push(h1("7. DevOps & Deployment"));
children.push(p("Docker Compose production setup includes: Postgres 16, Redis 7, MinIO, NestJS API, Next.js web, Caddy reverse proxy with automatic HTTPS. All services have health checks and proper dependency conditions. MinIO init creates buckets on startup."));
children.push(p("CI/CD Pipeline (GitHub Actions): Triggers on push/PR to main. Services: Postgres 16, Redis 7. Steps: checkout -> setup-node (24) -> corepack enable -> pnpm install --frozen-lockfile -> prisma generate -> prisma deploy -> typecheck -> build."));
children.push(p("CI gaps: No lint step, no test execution, no security scanning (Dependabot, Snyk, CodeQL), no deployment stage, no artifact publishing or Docker image push."));

// 8. Performance
children.push(h1("8. Performance & Scalability"));
children.push(makeTable(
  ["Aspect", "Assessment"],
  [
    ["Database queries", "Mostly well-scoped with tenantId filters; take: 150 / take: 5000 limits"],
    ["Redis caching", "Auth context cache (30s TTL) for user/tenant lookups"],
    ["BullMQ queues", "Offloads exports, notifications, reminders, reports from request thread"],
    ["Prisma connection pooling", "Default; no explicit pool sizing"],
    ["Frontend bundle", "Next.js with code splitting; no bundle analysis visible"],
    ["CDN", "No CDN configuration for static assets"],
  ],
  [4000, 5800]
));
children.push(p("Scalability limits: Single-node Docker Compose deployment. No horizontal scaling (Kubernetes), no database read replicas, single Redis instance. Acceptable for pilot / early SaaS; requires cloud migration for scale."));

// 9. Documentation
children.push(h1("9. Documentation"));
children.push(makeTable(
  ["Document", "Status", "Quality"],
  [
    ["README.md", "Complete", "Excellent: stack, architecture, install, env vars, commands, test accounts, roles, workflows"],
    ["docs/deploiement-heberjahiz.md", "Missing", "Referenced but not found in filesystem"],
    ["docs/guide-utilisation/", "Exists", "User guide directory present"],
    ["API docs (Swagger)", "Auto-generated", "Available at /api/docs with Bearer auth"],
    ["Code comments", "Good", "French comments in business logic; adequate"],
    ["Architecture decision records", "Missing", "No ADRs for key decisions"],
  ],
  [3500, 1800, 4500]
));

// 10. Strengths
children.push(h1("10. Strengths"));
[
  "Mature multi-tenant architecture with tenantId isolation at every layer, TenantGuard, cached tenant validation, and subscription plan support.",
  "Strong security posture: JWT with rotation, bcrypt, password policy, CSP, HSTS, rate limiting, production env validation, and anti-enumeration.",
  "Hierarchical approval engine: N1/N2/HR/Resource Manager chain with self-approval prevention and site-aware delegation.",
  "Comprehensive audit trail: Every state transition creates ApprovalAction + AuditLog with full traceability.",
  "Clean architecture boundaries: Custom script enforces frontend/backend separation; no Prisma leakage to frontend.",
  "Async job processing: BullMQ with Redis for exports, notifications, reminders, and reports to prevent request blocking.",
  "Production-ready Docker setup: Health checks, dependency conditions, Caddy HTTPS, MinIO initialization.",
  "French-localized UX: Full French interface for Moroccan B2B market with proper date-fns localization.",
  "GPS and site awareness: Latitude/longitude on sites, GPS radius, anomaly flagging, and work location tracking.",
  "Extensible settings model: TenantSettings with JSON arrays for configurable options (task types, site roles, clients, job titles).",
].forEach(s => children.push(bullet(s)));

// 11. Weaknesses
children.push(h1("11. Weaknesses & Risks"));
[
  "No unit tests: Critical business logic (approval hierarchy, state transitions, permissions) lacks Jest unit coverage.",
  "Token storage in localStorage: Access tokens stored in localStorage are XSS-vulnerable; should use httpOnly cookies with CSRF protection.",
  "No API versioning: Breaking changes will require coordinated frontend/backend deployment.",
  "Missing observability: No OpenTelemetry, Sentry, or structured logging; only basic request logging.",
  "No RBAC fine-grained permissions: Role-based only; no resource-level permissions (e.g., can only see Site X).",
  "No data encryption at rest: No column-level encryption for sensitive fields (PII, SSN, bank details).",
  "Limited CI/CD: No test execution, no linting, no security scanning, no deployment automation.",
  "No backup strategy: Docker Compose volumes with no documented backup/restore procedure.",
  "No GDPR/data retention: No data retention policies, no right-to-erasure implementation, no privacy policy.",
  "Missing real-time features: No WebSocket for live notifications, no Server-Sent Events for dashboard updates.",
  "No mobile app / PWA: GPS check-in is web-only; no offline capability for field workers.",
  "Email delivery is best-effort: void this.mail.send(...) fire-and-forget; no delivery tracking or retry queue.",
  "No database migration safety: No pgbouncer or connection draining for zero-downtime deploys.",
].forEach(s => children.push(bullet(s)));

// 12. Recommendations
children.push(h1("12. Recommendations (Prioritized)"));

children.push(h2("Critical (Do Before Production)"));
[
  "Move JWT from localStorage to httpOnly cookies — Mitigates XSS token theft risk; implement CSRF tokens or SameSite strict.",
  "Add unit tests — Jest + Supertest for all services; target 70%+ coverage for approval, auth, and hierarchy logic.",
  "Add CI test execution — Run critical.test.ts and critical.spec.ts in GitHub Actions.",
  "Implement structured logging — Pino/Winston with correlation IDs; integrate Sentry for error tracking.",
  "Add database backups — Automated pg_dump with retention; document restore procedure.",
].forEach(s => children.push(bullet(s)));

children.push(h2("High Priority (Within 1-2 Months)"));
[
  "API versioning — Introduce /api/v1/ prefix for future compatibility.",
  "Add observability — OpenTelemetry metrics, Prometheus/Grafana or APM (New Relic, Datadog).",
  "Fine-grained permissions — Replace role-based with attribute-based or resource-level ACL.",
  "Email reliability — Move to dedicated queue with retry, dead-letter, and delivery tracking.",
  "Security scanning — Add Dependabot, CodeQL, and container scanning (Trivy) to CI.",
].forEach(s => children.push(bullet(s)));

children.push(h2("Medium Priority (Within 3-6 Months)"));
[
  "PWA / Mobile responsiveness — Service worker for offline check-in; responsive GPS capture.",
  "Real-time notifications — WebSocket or SSE for approval events.",
  "Data retention & GDPR — Implement soft-delete + purge jobs, data export, right to erasure.",
  "Horizontal scaling — Kubernetes-ready containers, externalize session state, database read replicas.",
  "Performance monitoring — Add query performance logging, slow query alerts, bundle analysis.",
].forEach(s => children.push(bullet(s)));

// 13. Grading Matrix
children.push(h1("13. Grading Matrix"));
children.push(makeTable(
  ["Category", "Grade", "Weight", "Weighted Score"],
  [
    ["Architecture", "A", "20%", "18.0"],
    ["Security", "A-", "20%", "17.0"],
    ["Code Quality", "B+", "15%", "12.75"],
    ["Feature Completeness", "A", "15%", "15.0"],
    ["Testing", "C+", "15%", "10.5"],
    ["DevOps & Deployment", "B", "10%", "8.0"],
    ["Documentation", "B+", "5%", "4.25"],
    ["Overall", "B+ / A-", "100%", "85.5 / 100"],
  ],
  [3000, 1500, 1500, 3800]
));

// 14. Conclusion
children.push(h1("14. Conclusion"));
children.push(p("Pointage360 is a production-viable SaaS platform with a strong architectural foundation. The codebase reflects experienced engineering decisions: proper multi-tenancy, hierarchical approvals, comprehensive audit trails, and thoughtful security controls. It is ready for a controlled pilot launch with a single tenant or small group of beta customers."));
children.push(p("Before scaling to multiple tenants or public availability, the critical gaps must be addressed: (1) Token storage security (httpOnly cookies), (2) Unit test coverage, (3) CI/CD test execution, (4) Observability and monitoring, (5) Database backup strategy. With these investments, Pointage360 has the potential to become a competitive product in the construction and field-services HR tech market."));

const doc = new Document({
  features: { updateFields: true },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [para(run("Pointage360 — Project Evaluation Report", { bold: true, size: 18, color: "808080" }), { alignment: AlignmentType.RIGHT })],
      }),
    },
    footers: {
      default: new Footer({
        children: [para(new TextRun({ children: [PageNumber.CURRENT], size: 18 }), { alignment: AlignmentType.CENTER })],
      }),
    },
    children,
  }],
});

fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
console.log("DOCX created:", outputPath);
