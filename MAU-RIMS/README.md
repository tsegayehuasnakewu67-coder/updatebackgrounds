# MAU-RIMS

Mekdela Amba University Research Information Management System: a React/Vite client and Express/Mongoose API for research records.

## What is implemented

- Public landing page, researcher self-registration, sign-in/out, JWT session cookie, password recovery by SMTP email, profile/password management, protected application routes, and role-based API permissions.
- MongoDB models for users, researcher profiles, university organization units, priority areas, proposals/reviews, ethics applications, projects/milestones/progress, budgets/expenditures, documents, publications, collaborations, notifications, activities, audit logs, and system settings.
- Paginated and searchable record APIs, dashboards, assigned proposal reviewers and staged approvals, ethics decisions/certificates, notifications, document upload/download/version history, and summary PDF/Excel/CSV reporting.
- Responsive application shell and pages for proposals, projects, researchers, publications, ethics, budgets, departments, research areas, collaborations, progress reports, documents, reports, and proposal workflow configuration.

This is a working application foundation, not a certified production deployment. Institutional workflows and financial approval policies must be validated, object storage and automated backups must be configured for production, and the system still needs an institutional privacy and security assessment. Email-based password recovery requires SMTP configuration. Do not use it for sensitive production research data until those controls are reviewed.

## Requirements

- Node.js 20 or later and npm
- MongoDB Atlas URI or a local MongoDB instance

## Local setup

1. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, and the allowed `CLIENT_ORIGIN`. To enable password recovery, also set `CLIENT_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Never put backend secrets in the client environment.
2. Install dependencies from the repository root:

   ```powershell
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

3. Configure the initial administrator in `server/.env`:

   ```dotenv
   ADMIN_NAME=System Administrator
   ADMIN_EMAIL=admin@example.edu
   ADMIN_PASSWORD=use-a-unique-password-of-at-least-12-characters
   ```

4. Create the first administrator:

   ```powershell
   npm run create-admin --prefix server
   ```

5. Start both applications from the root:

   ```powershell
   npm run dev
   ```

   The frontend runs at `http://localhost:5173`; the API health check is `http://localhost:5000/api/health`.

6. (Optional) Create the two campus records and default priority areas. This is safe to rerun:

   ```powershell
   npm run seed-reference --prefix server
   ```

7. (Optional) Copy `client/.env.example` to `client/.env.local` and set `VITE_API_URL` if the API is not at `http://localhost:5000/api`.

8. Run the backend unit and API smoke tests:

   ```powershell
   npm test --prefix server
   ```

For frontend deployments, set `VITE_API_URL` to the backend API base URL at build time. Set the backend `CLIENT_ORIGIN` to the exact deployed frontend origin. Configure a persistent upload volume or external storage before hosting documents on an ephemeral platform.

## API outline

- Authentication: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Dashboard and reporting: `/api/dashboard`, `/api/reports/summary`
- Resource collections: `/api/proposals`, `/api/projects`, `/api/researchers`, `/api/publications`, `/api/ethicsApplications`, `/api/progressReports`, `/api/budgets`, `/api/expenditures`, `/api/documents`, `/api/collaborations`, `/api/notifications`, `/api/campuses`, `/api/colleges`, `/api/departments`, `/api/researchAreas`, `/api/milestones`, `/api/reviews`, `/api/activities`, `/api/auditLogs`, `/api/systemSettings`
- Proposal workflow actions: `POST /api/proposals/:id/submit`, `POST /api/proposals/:id/assign`, and `POST /api/proposals/:id/review`
- Proposal reviewer roles: `GET /api/workflow/proposals` and super-admin-only `PUT /api/workflow/proposals`; super administrators and directorate administrators remain emergency reviewers.
- Password recovery: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`; profile: `PATCH /api/auth/profile`, `POST /api/auth/change-password`
- Report exports: `GET /api/reports/export/pdf` and `GET /api/reports/export/xlsx`
- Document upload and download: `POST /api/documents` (multipart field `file`) and `GET /api/documents/:id/download`
- User administration: `GET/POST /api/users`, `PATCH/DELETE /api/users/:id`

List routes accept `page`, `limit`, `search`, and (where relevant) `status`, `sort`, and `order` query parameters. Authorization is enforced on the API; hiding a UI control is not treated as an access control.

## Initial role setup

Public registration always creates a `principal_investigator`; it cannot choose an elevated role. Use the super administrator account to create accounts and assign roles through the user administration API. The user API is restricted to administrators.

## Deployment notes

- Keep `.env` files and secrets out of source control.
- Require HTTPS in production; the authentication cookie is marked `Secure` when `NODE_ENV=production`.
- Use a unique production MongoDB database user with only the required database permissions and enable backups/retention in Atlas.
- Set an explicit production `CLIENT_ORIGIN`, rate-limit and monitor the API, and use managed private object storage for uploaded documents.
- Provision backups, retention, access reviews, and incident-response procedures according to university policy.
