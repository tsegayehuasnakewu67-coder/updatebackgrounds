# Smart Attendance Management System

## Backend installation

```powershell
cd backEnd
npm install
```

The backend uses Express, Mongoose, bcryptjs, and JWT. No local `mongod` is
required when `MONGODB_URI` points to MongoDB Atlas.

## MongoDB and environment configuration

For local MongoDB on Windows, install MongoDB Community Server and start its
service from an elevated PowerShell prompt:

```powershell
Get-Service *Mongo*
Start-Service MongoDB
```

The service may have a different name depending on the installation. You can
also use MongoDB Atlas by setting `MONGODB_URI` to its `mongodb+srv://` URI.

Create `backEnd/.env` (or copy `backEnd/.env.example`) and set:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/SmartAttendanceDB
MONGODB_DB_NAME=SmartAttendanceDB
RUN_EMPLOYEE_MIGRATION=false
JWT_SECRET=<a random secret of at least 32 characters>
JWT_EXPIRES_IN=7d
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@smartattendance.com
ADMIN_PASSWORD=<a unique strong password>
DEFAULT_EMPLOYEE_PASSWORD=<a unique strong password>
CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<sending Gmail address>
SMTP_PASS=<Gmail App Password>
EMAIL_FROM=Smart Attendance <sending Gmail address>
API_RATE_LIMIT_MAX=100
ADMIN_MESSAGES_RATE_LIMIT_MAX=300
LOGIN_RATE_LIMIT_MAX=10
PASSWORD_RESET_RATE_LIMIT_MAX=5
PASSWORD_RESET_VERIFY_RATE_LIMIT_MAX=15
CONTACT_RATE_LIMIT_MAX=5
ATTENDANCE_SCAN_RATE_LIMIT_MAX=10
FACE_REGISTER_RATE_LIMIT_MAX=1200
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=0
MONGODB_MAX_IDLE_TIME_MS=60000
TRUST_PROXY_HOPS=0
```

Never commit `.env`. The initial administrator password is read from
`ADMIN_PASSWORD` and hashed with bcrypt before it is stored. `npm run
seed:admin` safely creates the configured administrator only when no
administrator exists; it never changes an existing password. If an existing
administrator uses a different email, verify the account before changing the
configured `ADMIN_EMAIL`.

To create or verify the configured Admin account in VS Code, open a PowerShell
terminal at the repository root and run:

```powershell
cd .\backEnd
npm run seed:admin
```

Set your own `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters with uppercase,
lowercase, number, and symbol), and optional `ADMIN_NAME` in `backEnd\.env`
before running the command. If that email already belongs to an Admin, seeding
does not change its password; use the account's existing password or the
Forgot Password flow to change it.

Public registration is disabled: `/signup` redirects to `/login`, and the
legacy `POST /api/auth/signup` endpoint returns HTTP 403. Admins create
employees from the protected Admin dashboard; `POST /api/auth/register`
requires an authenticated Admin and always assigns the Employee role on the
server. HR accounts use the separate protected `/admin/register-hr` page and
`POST /api/auth/register-hr` endpoint. Generic account updates cannot promote
an account to Admin or HR.

Admin-created employee accounts use `DEFAULT_EMPLOYEE_PASSWORD`. Keep it in
the backend environment only, deliver it to new employees through an approved
secure channel, and change it before deployment. Employees sign in with their
employee ID or email and must set a new password (minimum 12 characters with
uppercase, lowercase, number, and symbol) before any authenticated dashboard,
profile, or attendance API is available. Password changes hash with bcrypt
and invalidate prior JWTs. Admins can reset employee accounts to the configured
default password; resetting an Admin or HR account sends a single-use reset
link instead.

Forgot Password sends a cryptographically random six-digit code to the registered
account email. Codes are stored as keyed hashes, expire after 10 minutes, permit
five attempts, and have a 60-second resend cooldown. Successful verification
creates a single-use reset grant, stored only as a hash and held by the browser
in session storage until password reset. Previously issued reset links remain
supported for Admin/HR reset flows and expire after 15 minutes. Both workflows
use SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASS`, and `EMAIL_FROM`). Without SMTP, the API returns a safe
configuration error and sends no code. Configure SMTP before relying on email
recovery.

For Gmail, enable two-step verification on the sender account, create a Google
App Password from Google Account security settings when eligible, and put it in
`SMTP_PASS` in `backEnd/.env` (never in chat or frontend code). Set `SMTP_USER`
and `EMAIL_FROM` to the sending Gmail address, then restart the backend. Verify
the configuration without displaying credentials by running
`npm --prefix backEnd run email:verify` from the repository root.

Public Contact form submissions are rate limited by `CONTACT_RATE_LIMIT_MAX`,
deduplicated using a client-generated request key, and stored in the
`contactmessages` MongoDB collection. A persisted unread `contact_message`
notification is created for each active Admin and appears in the topbar bell;
the bell refreshes every 30 seconds and links directly to the ticket in the
Admin Contact Inbox. Notification records are scoped to their recipient and
stored in MongoDB. The Admin Contact Inbox
is protected by both JWT authentication and Admin-role authorization; it supports
search by ticket ID/name/email/subject, Pending/In Progress/Replied/Closed status
filters, read state, reply history, and confirmation-based delete. Replies are
protected by a dedicated `ADMIN_MESSAGES_RATE_LIMIT_MAX` quota in addition to
the Admin authorization check. Replies are saved before notification delivery;
in-app notification and email delivery results are reported separately.
Authenticated senders receive an in-app notification and read the conversation
in My Messages. Anonymous replies are emailed to the submitted address using
the existing SMTP environment values; the email includes the original message
and Admin reply. Their delivery outcome (`sent`, `failed`, or `not_configured`)
is stored on the ticket and shown in the Inbox. Configure the existing SMTP
environment values to enable reply emails. No SMTP credentials belong in
frontend configuration.

Employees can submit account-linked tickets and view their own ticket history and
Admin replies at `/me/messages`. Ticket ownership is attached from the verified
JWT account; the API never uses a submitted user ID, email address, or ticket ID
to authorize employee reads. Anonymous tickets have no public lookup endpoint,
so a ticket ID alone cannot expose the message or reply history. Anonymous
senders receive replies by email only when SMTP is configured. Employee follow-up
replies are currently disabled; employees can reply to the configured support
email or open another ticket.

The new password fields are additive. Existing user records with no
`mustChangePassword` value remain eligible to sign in normally; existing
passwords are not overwritten and the feature does not perform a forced
migration. Employee profiles that have no login account are not backfilled
automatically. Create/link those accounts through the Admin registration
workflow using the existing employee ID and email.

The employee migration can update existing attendance records and indexes, so
it is disabled by default. Set `RUN_EMPLOYEE_MIGRATION=true` only when you
intend to run it against this database and have reviewed/backed up the data.

## Ethiopia time and calendar

Attendance decisions, scheduled attendance jobs, and recorded event times use
the `Africa/Addis_Ababa` time zone (UTC+03:00). The admin Shift Settings page
keeps the current work schedule at 08:30–17:00 with a 5-minute grace period
and lunch disabled unless an administrator changes it.

Dates are displayed using the Ethiopian calendar, and clock times use the
24-hour format in `Africa/Addis_Ababa`. MongoDB timestamps remain stored in UTC
and are converted for display. Attendance date keys and date-filter inputs
remain Gregorian `YYYY-MM-DD` values for API and database compatibility.

## Seed the database

```powershell
npm run seed
```

The seed command connects to the configured MongoDB database first, then
creates the administrator, departments, sample employees, and sample
attendance records only when those records do not already exist.

## Start the backend

```powershell
npm run dev
```

The API is available at `http://localhost:5000`; check its database status at
`http://localhost:5000/api/health`.
The root `npm run dev` launcher allows up to five minutes for the backend to
connect to MongoDB and finish startup. Set `BACKEND_STARTUP_TIMEOUT_MS` to a
positive number of milliseconds to override that limit.

## Start the frontend

In another terminal:

```powershell
cd frontEnd
npm install
npm run dev
```

The Vite development server uses port `5173`. By default it proxies `/api` to
`http://localhost:5000`. To call the backend directly, create
`frontEnd/.env.local` with `VITE_API_URL=http://localhost:5000/api`.

## Face enrollment and attendance

The face-api.js model manifests and weight shards must be available under
`frontEnd/public/models` for registration and the camera kiosk. The application
uses 128-value face descriptors and a Euclidean match threshold of `0.6`.
New check-ins are closed at the configured shift end; employees with an
existing attendance record can still scan to complete checkout. Checkout times
are recorded from the actual scan, and missing check-outs are not synthesized.

On the Admin > Employees page, **Bulk upload** accepts the downloadable CSV
template. To enroll faces in the same batch, also select one JPEG, PNG, or WebP
photo per employee and name each file with the employee ID (for example,
`EMP001.jpg`). The browser extracts one face descriptor per selected photo;
raw photo files are not sent to or stored by the backend. The import validates
the descriptors against existing registrations and other rows before saving.
Every valid profile imported from the Admin bulk CSV workflow must include an
email address and is linked to a login account using
`DEFAULT_EMPLOYEE_PASSWORD`. Existing IDs/emails and duplicate rows remain
rejected; imported face descriptors and attendance history are preserved.

The public `/kiosk` route uses the live camera stream only. Each attendance
attempt requests a short-lived, one-use server challenge to blink or turn the
head, then submits the live frame's descriptor. This is a best-effort check
against static photographs, not a presentation-attack detector: it cannot
guarantee physical presence or stop replayed video, deepfakes, or a modified
browser client. Deploy a validated PAD model or trusted capture hardware if
that level of assurance is required. Attendance reports already provide CSV
export.

## API security and attendance APIs

The backend sends Helmet security headers, sanitizes Mongo-style query keys,
and allows credentialed CORS only for origins listed in the comma-separated
`CLIENT_URLS` variable (`CLIENT_URL` remains a fallback). The default API
limit is 100 requests per IP per 15 minutes; login attempts are limited to 10
per 15 minutes. Face-row registration is admin-authenticated and has its own
1,200-request limit so the sequential uploader can process up to 1,000 rows
without being interrupted by the general API limit. Tune these values for the
deployment. Behind a reverse proxy, set `TRUST_PROXY_HOPS` to the exact number
of trusted proxy hops; leave it at `0` when directly exposed.

MongoDB pool defaults are 20 maximum connections and can be tuned with
`MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE`, and
`MONGODB_MAX_IDLE_TIME_MS`.

Admin-only face enrollment APIs:

- `POST /api/face/bulk-preview` — multipart form data: `csv` (one `.csv`) and
  repeated `photos` (JPG/PNG). The CSV must include `photoFileName`; filenames
  are matched case-insensitively. The preview reports invalid rows and
  duplicate IDs/emails without saving employee profiles.
- `POST /api/face/register` — enroll one employee face descriptor.
- `POST /api/face/bulk-register` — enroll one row per request for sequential
  bulk workflows. Each descriptor is checked against registered faces before
  saving.

Bulk preview limits each file to 5 MB, the CSV to 1,000 employee rows, and the
complete multipart request to 100 MB. Attendance uses the existing
Addis-Ababa `YYYY-MM-DD` date key and liveness challenge flow:

- `POST /api/attendance/scan` — same live descriptor and one-use liveness
  challenge validation as `/mark`; scan attempts are limited to 10 per IP per
  minute by default.
- `GET /api/attendance/today` — authenticated admin/HR records for the current
  Addis-Ababa calendar date.
- `GET /api/attendance/report?from=YYYY-MM-DD&to=YYYY-MM-DD` — paginated
  date-range report; ranges are limited to 367 inclusive days.
- `GET /api/attendance/export?from=YYYY-MM-DD&to=YYYY-MM-DD` — streaming CSV
  export with spreadsheet-formula escaping.

Protected routes continue to use the existing JWT and role middleware.
Validation failures use a consistent `{ success: false, error, message }`
response shape, and unknown routes return a structured 404.

Administrators can review sensitive account, attendance correction, leave,
shift-configuration, failed-login, and face-verification events at
`/admin/audit-logs`. The API at `GET /api/admin/audit-logs` is admin-only,
paginated, and supports `page`, `limit`, `action`, `resourceType`, `from`, and
`to` filters. Failed face scans are retained in the existing 90-day
`FaceScanAttempt` collection and are available from the separate
**Face verification failures** view. Audit details intentionally omit
passwords, tokens, and biometric descriptors. If an operation succeeds while
MongoDB cannot persist its audit event, the response includes an `auditWarning`
and the backend logs the failure.

Admin sign-in uses the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values configured in
`backEnd/.env`. Successful login returns a JWT; protected API requests use it
as a Bearer token.
