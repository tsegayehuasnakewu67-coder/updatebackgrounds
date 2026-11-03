# Research Information Management System (RIMS) — Project Plan

## Status

Approved by the user.

## Goal

Build a responsive, deployable research information management application that connects a React frontend, an Express REST API, and MongoDB through Mongoose. Implement the workflows end to end rather than presenting static dashboard data.

## Stack

- Frontend: React, JavaScript, Vite, Tailwind CSS, React Router, Axios, React Hook Form, Recharts, and Lucide React.
- Backend: Node.js, Express, Mongoose, JWT, bcrypt, Multer, and Express Validator.
- Database: MongoDB Atlas via a `MONGODB_URI` environment variable.
- Testing: backend API tests and frontend tests using the repository-appropriate lightweight test tooling.
- Deployment: frontend suitable for Vercel/Netlify; backend suitable for Render; document environment variables and production setup.

## Application structure

Use a root workspace with `frontend/` and `backend/` packages, a root README, and environment example files. Keep API routes, controllers, models, middleware, and configuration separated on the backend; keep pages, reusable components, API clients, auth state, and route protection separated on the frontend.

## Roles and access

- Administrator: manage users and system-wide research records; review proposals; access system-level reports and settings.
- Research coordinator: review proposals and documents, provide feedback, monitor projects, and access departmental reporting.
- Researcher: manage their profile and own proposals, projects, documents, progress reports, budgets, and publications.

Enforce access in API middleware and validate ownership/department scope in resource handlers, not only in the UI. Public self-registration creates a researcher account; privileged roles are provisioned by an administrator. Never provide a public administrator seed credential.

## Functional scope

1. Authentication: register, login, logout/client token clearing, password hashing, JWT-protected routes, role checks, and forgot/reset password flow. Password reset uses expiring, single-use tokens; delivery is configured through environment-backed email settings. If email delivery is not configured in local development, expose no reset secrets in public responses or logs and document the setup requirement.
2. Dashboard: role-aware counts, project/proposal status charts, and recent activity from persisted records.
3. Researcher management: profiles, search, department/research-area filters, and authorized CRUD.
4. Projects and proposals: CRUD, researcher assignments, date/status tracking, proposal submission and review decisions with feedback and audit activity.
5. Documents: validated uploads and authorized downloads, metadata/category search, and version metadata. Use local disk storage for development behind a storage service boundary; document that production should use durable object storage rather than ephemeral hosting disks.
6. Progress and budgets: reports/milestones with review feedback; estimated and actual costs with computed balances and authorized reporting.
7. Publications: record metadata, authors, journal/date, optional file attachment, and search/filter.
8. Notifications and activities: persist notifications and audit events for important submissions, decisions, and feedback; provide authenticated listing and read-state actions.
9. Reports: role-scoped researcher, project, proposal, and budget reports. Provide CSV exports as the initial practical export format; PDF/XLSX can be added if the chosen packages and runtime are available without compromising the core workflows.
10. UI: professional dark-blue/green/gray theme, responsive sidebar and top bar, landing/auth pages, accessible forms/tables/dialogs, search/filter, loading/error/success states, and usable empty states.

## Data model

Create timestamped, validated Mongoose models for Users, Researchers, Projects, Proposals, Documents, ProgressReports, Budgets, Publications, Notifications, and Activities. Use references for ownership and relationships, indexes for common search/filter fields, and schema-level constraints for status, amounts, and required fields. Store password hashes and reset-token hashes only; never store raw reset tokens.

## API and security

Provide `/api/auth`, `/api/users`, `/api/researchers`, `/api/projects`, `/api/proposals`, `/api/documents`, `/api/progress`, `/api/budgets`, `/api/publications`, `/api/notifications`, and `/api/reports` routes. Include centralized error handling, request validation, pagination/search, authentication and role/ownership authorization, upload size/type limits, rate limiting for authentication, explicit CORS origins, secure headers, and environment-based secrets. Do not commit credentials or require a real Atlas connection for unit tests.

## Delivery phases

1. Establish the monorepo structure, package scripts, environment examples, shared API conventions, and local setup documentation.
2. Implement backend configuration, models, authentication/authorization, validation, and core CRUD/report routes.
3. Implement the frontend shell, authentication, protected role-aware navigation, dashboards, forms, tables, and API integration.
4. Complete uploads, notifications, reporting, and cross-module workflows.
5. Add focused tests, run build/type/lint/test commands available in the workspace, fix regressions, and document local setup, environment variables, testing, and deployment.

## Acceptance criteria

- A clean install can start frontend and backend using documented commands.
- With valid environment variables, the backend connects to MongoDB and serves the documented API routes.
- Registration/login, password hashing, JWT protection, role restrictions, and resource ownership are tested.
- Core records persist and are accessed through the API; dashboard metrics are computed from persisted records.
- Forms, navigation, search/filter, review decisions, uploads/downloads, notifications, and reports are connected to real application behavior with visible validation and error states.
- Upload limits and authorization are enforced server-side.
- No real secrets are present in tracked files; `.env.example` and deployment instructions are provided.
- Focused automated tests and production frontend/backend builds pass, or any environment-dependent limitation is clearly documented.

## Assumptions requiring approval

- Use Vite for the React application and npm workspaces for the repository.
- Self-registration is limited to researchers; administrators create or promote coordinators/admins.
- Local filesystem storage is for development only; production document storage requires durable object storage.
- CSV is the initial report export format; PDF and Excel exports are secondary to the complete persisted workflows.
- The project will include email-reset integration points, but actual delivery requires user-provided SMTP/provider credentials.
