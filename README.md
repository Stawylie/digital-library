Digital Library — Setup and Troubleshooting (Windows)

This project uses PostgreSQL via Sequelize. If you see this error in PowerShell:

psql : The term 'psql' is not recognized as the name of a cmdlet, function, script file, or operable program.

it means the PostgreSQL client (psql.exe) is not installed or not on your PATH. Follow the steps below to install PostgreSQL, fix PATH, configure your database, and run the app.

Prerequisites
- Node.js 18+ (check: node -v)
- npm (check: npm -v)
- PostgreSQL 14+ (server and client tools)

Option A — Install PostgreSQL (recommended)
1) Download and install PostgreSQL for Windows:
   - https://www.postgresql.org/download/windows/
   - During setup, check the option to install “Command Line Tools” and, if offered, “Add to PATH”.
2) Locate psql after installation (examples):
   - C:\Program Files\PostgreSQL\16\bin\psql.exe
   - C:\Program Files\PostgreSQL\15\bin\psql.exe
3) Verify psql works:
   - Close and reopen PowerShell, then run: psql --version
   - If still “not recognized”, see Fix PATH below.

Option B — Install via package manager
- Using winget (Windows 10/11):
  winget install --id=PostgreSQL.PostgreSQL -e
- Or Chocolatey (requires admin PowerShell):
  choco install postgresql -y
After installation, open a new PowerShell window and run: psql --version

Fix PATH (if psql not recognized)
1) Find where psql.exe is installed (search in C:\Program Files\PostgreSQL):
   - e.g., C:\Program Files\PostgreSQL\16\bin
2) Temporarily update PATH in the current PowerShell session:
   $env:Path = "C:\\Program Files\\PostgreSQL\\16\\bin;" + $env:Path
   psql --version
3) Permanently add to PATH (Windows Settings → System → About → Advanced system settings → Environment Variables → Path) and add the bin folder above. Open a new terminal afterward.

Start PostgreSQL service
- Ensure the PostgreSQL Windows service is running:
  Get-Service | Where-Object {$_.Name -like "postgresql*"}
  # If stopped, start it (adjust service name if different):
  Start-Service postgresql-x64-16

Create database and user (one-time)
1) Connect as the postgres superuser (replace password prompt accordingly):
   psql -U postgres
2) In psql, run:
   CREATE DATABASE digital_library;
   CREATE USER digital_user WITH PASSWORD 'your_strong_password_here';
   GRANT ALL PRIVILEGES ON DATABASE digital_library TO digital_user;
   \q

Configure environment
1) Copy .env.example to .env in the project root:
   - DB_HOST=localhost
   - DB_NAME=digital_library
   - DB_USER=digital_user
   - DB_PASS=your_strong_password_here
2) Make sure PostgreSQL listens on localhost (default) and the service is running.

Run the app
1) From the project root:
   npm start
2) Check DB health:
   - Open http://localhost:3000/health/db
   - Expect: { connected: true, synced: true, tables: [...] }
3) Test endpoints:
   - GET http://localhost:3000/api/resources → [] if empty
   - POST http://localhost:3000/api/notifications with JSON { "userId": 1, "message": "New resource available!" }

Troubleshooting
- psql not recognized
  - Install PostgreSQL client tools or add C:\Program Files\PostgreSQL\<version>\bin to PATH.
  - Open a new PowerShell window after changing PATH.
- ECONNREFUSED / Database sync failed
  - Ensure the PostgreSQL service is running (Start-Service ...).
  - Verify credentials in .env match the DB and user you created.
  - Confirm connectivity from the app host: psql -h localhost -U digital_user -d digital_library
- Port 3000 already in use
  - Free the port (PowerShell):
    $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($conn) { Stop-Process -Id $conn.OwningProcess -Force; Write-Output "Stopped process listening on port 3000 (PID $($conn.OwningProcess))" } else { Write-Output "No process was listening on port 3000" }

Optional: Use Docker for PostgreSQL
If you prefer not to install PostgreSQL natively, you can run a local container (Docker Desktop required):
- docker run --name pg-digital -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
- Create DB and user inside the container:
  docker exec -it pg-digital psql -U postgres -c "CREATE DATABASE digital_library;"
  docker exec -it pg-digital psql -U postgres -c "CREATE USER digital_user WITH PASSWORD 'your_strong_password_here';"
  docker exec -it pg-digital psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE digital_library TO digital_user;"
- Set .env to:
  DB_HOST=localhost
  DB_NAME=digital_library
  DB_USER=digital_user
  DB_PASS=your_strong_password_here

Notes for developers
- The server runs with: npm start (node ./bin/www)
- Sequelize auto-sync is enabled (sequelize.sync({ alter: true })) on startup.
- Health endpoint: GET /health/db provides connection and table check.

MFA and Authentication
This project now includes email/password authentication with optional TOTP-based MFA (Google Authenticator, Microsoft Authenticator, etc.).

Environment
- Add to your .env (see .env.example):
  - JWT_SECRET=your_strong_random_secret
  - APP_NAME=Digital Library (optional, used in authenticator label)

New endpoints (prefix /api/auth)
- POST /api/auth/register
  - body: { "name": "Kyle", "email": "you@example.com", "password": "secret" }
  - response: { id, email, name, role, mfaEnabled }
- POST /api/auth/login
  - body: { "email": "you@example.com", "password": "secret" }
  - responses:
    - If MFA disabled: { token, user }
    - If MFA enabled: { mfaRequired: true, mfaToken, user }
- GET /api/auth/me
  - header: Authorization: Bearer <token>
  - response: user profile
- POST /api/auth/mfa/setup
  - header: Authorization: Bearer <token> (must be logged in and MFA disabled)
  - response: { base32, otpauth_url, qrDataUrl }
  - Scan the QR in your authenticator app, then call verify with the 6-digit code.
- POST /api/auth/mfa/verify
  - header: Authorization: Bearer <mfaToken or normal token>
  - body: { "code": "123456" }
  - response: { ok: true, token, user }
- POST /api/auth/mfa/disable
  - header: Authorization: Bearer <token>
  - body: { "code": "123456" }
  - response: { ok: true }

Typical flow
1) Register a user: POST /api/auth/register.
2) Login: POST /api/auth/login.
   - If MFA not enabled, you receive token and can proceed.
3) Enable MFA:
   - Call POST /api/auth/mfa/setup with the token from step 2; scan the QR with your authenticator.
   - Call POST /api/auth/mfa/verify with the 6-digit code; you receive a new token.
4) Future logins:
   - POST /api/auth/login. If MFA is enabled, you get { mfaRequired: true, mfaToken }.
   - POST /api/auth/mfa/verify with the code and the mfaToken to receive the full access token.

Notes
- Tokens are signed with JWT_SECRET and default to 1h expiry.
- Set ADMIN_BYPASS=true only for local testing of admin routes.
- The User model now has mfaEnabled and mfaSecret columns; schema updates are auto-applied by Sequelize sync.



---

Testing MFA end-to-end (step-by-step)

Follow these steps to verify the email/password + TOTP MFA flow using PowerShell on Windows. Substitute the actual port printed at startup if it isn’t 3000.

Prerequisites
- .env contains your DB settings and JWT secret (see .env.example). Example:
  - DB_HOST=localhost
  - DB_NAME=digital_library
  - DB_USER=dl_user
  - DB_PASS=dl_pass123
  - JWT_SECRET=change_me_super_secret
- Install dependencies and start the server:
  - npm install
  - npm start
- Note the printed URL, e.g., Server listening on http://localhost:3000
- Verify:
  - http://localhost:<port>/health/config → ok: true
  - http://localhost:<port>/health/db → connected: true, synced: true

PowerShell quick-start variables

$port = 3000
$base = "http://localhost:$port"

1) Register a user (one-time)

$registerBody = @{ name = "Test User"; email = "test@example.com"; password = "Passw0rd!" } | ConvertTo-Json
$register = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -Body $registerBody -ContentType "application/json"
$register

Expected: JSON with the new user; mfaEnabled should be false.

2) Login (no MFA yet)

$loginBody = @{ email = "test@example.com"; password = "Passw0rd!" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -Body $loginBody -ContentType "application/json"
$login

- If MFA is not enabled yet: you get { token, user }. Save the token:
$token = $login.token

3) Set up MFA (generate secret + QR)

# Authenticated call using the token from step 2
$headers = @{ Authorization = "Bearer $token" }
$setup = Invoke-RestMethod -Method Post -Uri "$base/api/auth/mfa/setup" -Headers $headers
$setup | Format-List

- Scan the QR in your authenticator app:
  - Open the value in your browser: $setup.qrDataUrl (data URL) or copy $setup.otpauth_url into a QR site if needed.
  - This registers a TOTP entry like "Digital Library (test@example.com)".

4) Verify MFA code (enable MFA and get a fresh access token)

$code = Read-Host "Enter the 6-digit code from your authenticator"
$verifyBody = @{ code = $code } | ConvertTo-Json
$verify = Invoke-RestMethod -Method Post -Uri "$base/api/auth/mfa/verify" -Headers $headers -Body $verifyBody -ContentType "application/json"
$verify

- Expected: { ok: true, token, user } and user.mfaEnabled: true. Save new token:
$token = $verify.token

5) Test a protected endpoint (profile)

$meHeaders = @{ Authorization = "Bearer $token" }
$me = Invoke-RestMethod -Method Get -Uri "$base/api/auth/me" -Headers $meHeaders
$me

Expected: your user profile JSON.

6) Test the MFA-required login flow (future logins)

# First, log out mentally (no real endpoint needed), then login again:
$login2 = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -Body $loginBody -ContentType "application/json"
$login2

- Expected: { mfaRequired: true, mfaToken, user } (no full token yet).

# Verify with the current 6-digit code
$mfaHeaders = @{ Authorization = "Bearer $($login2.mfaToken)" }
$code = Read-Host "Enter the 6-digit code from your authenticator"
$verify2 = Invoke-RestMethod -Method Post -Uri "$base/api/auth/mfa/verify" -Headers $mfaHeaders -Body (@{ code = $code } | ConvertTo-Json) -ContentType "application/json"
$verify2

- Expected: { ok: true, token, user }. Use verify2.token for subsequent API calls.

Optional: curl examples (cmd/PowerShell)

:: Register
curl -s -X POST "%base%/api/auth/register" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"Passw0rd!\"}"

:: Login
curl -s -X POST "%base%/api/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"Passw0rd!\"}"

:: Setup MFA (replace <TOKEN>)
curl -s -X POST "%base%/api/auth/mfa/setup" -H "Authorization: Bearer <TOKEN>"

:: Verify MFA (replace <TOKEN> and <CODE>)
curl -s -X POST "%base%/api/auth/mfa/verify" ^
  -H "Authorization: Bearer <TOKEN>" ^
  -H "Content-Type: application/json" ^
  -d "{\"code\":\"<CODE>\"}"

Troubleshooting tips
- 401 on /api/auth/login: wrong email/password. Emails are matched case-insensitively and trimmed; ensure you didn’t include leading/trailing spaces and that you’re using the same password you registered with. If you haven’t created an account on this backend yet, register first (from /login or POST /api/auth/register).
- 404 on /api/auth/register or /api/auth/login: database not configured (auth routes not mounted) or wrong API Base URL. Check /health/config and /health/progress. If configReady=false, configure DB in .env and restart. If using a different host/port, set the correct API Base in the Connection panel on /login and click "Save & Retest".
- 503 on /api/auth/*: Limited mode. The backend is running without DB; auth routes respond 503 with a JSON hint. Configure DB in .env (DATABASE_URL or DB_* vars), restart the server, then try again.
- 400/401 on /api/auth/mfa/verify: wrong/expired TOTP code; wait for next 30-second window and retry.
- 503 on /api/admin/*: set ADMIN_TOKEN or ADMIN_BYPASS=true in .env.
- "Database environment not configured": ensure .env has either DATABASE_URL or all DB_* variables, then restart.
- CORS/fetch errors from admin.html opened via file://: prefer opening http://localhost:<port>/admin so requests target the same origin.
- Browser login/admin page shows "Cannot reach backend service": start the server with `npm start` and open http://localhost:3000/login (or /admin). If your API runs on a different host/port, use the new Connection panel on the page to set an API Base URL override and click "Save & Retest". The override is stored in localStorage and can be reset.



Health, Progress, and Diagnostics Endpoints
- GET /health/config — Always available. Shows whether required database env vars are configured (without leaking secrets).
- GET /health/progress — Lightweight heartbeat endpoint intended to give fast, conclusive feedback that the service is responsive. Returns:
  {
    ok: boolean,
    message: string,
    uptimeSec: number,
    configReady: boolean,
    db: { available: boolean, latencyMs?: number, reason?: 'timeout'|'db_config_missing'|'error', message?: string }
  }

Admin Dashboard Status Bar and Diagnostics
- Open /admin. A status bar now appears at the top and polls /health/progress every 5 seconds.
- It clearly reflects:
  - OK (green): backend + DB reachable
  - Warning (yellow): backend up but DB not configured or ping timed out (retrying)
  - Error (red): backend unreachable or DB unavailable

Troubleshooting "tasks running without conclusive feedback"
- If the UI appears to be waiting, check the status bar message and hit /health/progress directly in your browser.
- If DB is not configured, follow the steps in this README to configure PostgreSQL and .env.
- If DB ping times out, verify service is running and that the app can reach the DB host/port.



Testing (MFA and Auth)
- Automated unit tests are included for the MFA flow using Jest. These tests run entirely in-memory (no database required) by mocking the User model.

Prerequisites
- Node.js 18+

Install dev dependencies
- npm install

Run tests
- npm test

What the tests cover
- Register → login without MFA returns an access token
- Start MFA setup → secret and QR data are produced
- Verify MFA with a valid TOTP code enables MFA and returns a full token
- Login with MFA enabled returns mfaRequired and an mfaToken
- Verify with the mfaToken returns a full access token
- Disable MFA with a valid code
- Negative case: verifying with a wrong code returns 401

Notes
- Tests set JWT_SECRET to a deterministic value and do not require any environment configuration or a running PostgreSQL instance.
- If you want to manually test with real requests, see the MFA and Authentication section above for step-by-step curl/PowerShell examples.



HTML Login + MFA Demo
- A simple HTML page is available at /login for testing email/password login and MFA challenge in the browser. You can now also register a user directly from this page.
- How it works:
  1) Open http://localhost:3000/login
  2) Enter email and password, submit.
     - If the user has MFA disabled, you will receive a token and the page will fetch /api/auth/me.
     - If the user has MFA enabled, the page will show a second step asking for the 6‑digit TOTP code, and will call POST /api/auth/mfa/verify with the temporary mfaToken.
  3) On success, the final access token is stored in memory and /api/auth/me is fetched to display user info.
- Notes:
  - You need a database configured and at least one user account created to log in via the HTML page.
  - The page includes the same heartbeat status bar that polls /health/progress for quick feedback on backend/DB availability.
  - If you see Login failed (HTTP 404) from /api/auth/login, it usually means the database is not configured. In this state the server starts in limited mode and does not mount /api/auth/* routes. Configure DB env (.env), restart the server, and try again.
  - For setting up a user and enabling MFA, use the existing auth endpoints or follow the curl/PowerShell examples in this README. Once MFA is enabled for a user, the login page will correctly require and verify the code.



Credentials to use (no default account)
- There are no built‑in/default user credentials in this project.
- You can create your own test user via the public registration endpoint once your database is configured and the server is running.

Quick start: create a test user
- Prerequisite: DB configured (.env) and server running (npm start). The auth routes are only mounted when the DB is configured.
- PowerShell example (adjust email/password as desired):
  $base = "http://localhost:3000"
  curl -s -X POST "$base/api/auth/register" -H "Content-Type: application/json" -d '{"name":"Tester","email":"tester@example.com","password":"Pa$$w0rd!"}'
- After registration, use the same email/password on the HTML login page at /login or via the login endpoint:
  curl -s -X POST "$base/api/auth/login" -H "Content-Type: application/json" -d '{"email":"tester@example.com","password":"Pa$$w0rd!"}'

Admin access
- Admin routes under /api/admin are protected by a simple middleware. Use one of:
  - Set ADMIN_BYPASS=true in .env for local development to bypass checks.
  - Or set ADMIN_TOKEN to a strong value in .env and send header X-Admin-Token: <that value> with requests.

Notes about MFA
- MFA is optional. If enabled for a user, login will first return mfaRequired with an mfaToken; then verify using /api/auth/mfa/verify with the 6‑digit code from your authenticator app.
- The HTML login page at /login handles this flow automatically.
- For scripted/manual testing, see the MFA and Authentication section above for curl/PowerShell examples.



Diagnostics: If it still doesn’t work
- A deep diagnostics endpoint is available at GET /health/doctor. It is always available and safe to call.
- It performs the following checks and returns a single JSON payload with guidance:
  - Environment/configuration status: whether DATABASE_URL or DB_* (or PG*) variables are set; which are missing.
  - Database connectivity: attempts a short authenticate() with timeout and reports timeout or error messages.
  - Tables check: verifies that core tables for User, Resource, and Notification exist. If not, suggests allowing sequelize.sync({ alter: true }) to run or to create the schema.
  - Tips: An array of actionable next steps tailored to any failures detected.

How to use
1) Start the server (npm start). If the server can’t fully start with DB, it will still serve /health/config, /health/progress, and /health/doctor.
2) Open http://localhost:3000/health/doctor in your browser.
3) Read the summary and tips fields. Follow the instructions (e.g., create .env, start PostgreSQL service, fix credentials, let tables sync).
4) Re-run until ok=true, then proceed to use /login and other routes.

From the browser UIs
- On /login, a “View diagnostics” link appears under the status bar. Click it to open /health/doctor in a new tab.
- On /admin, click “Run diagnostics” to fetch and display the JSON inline.

Examples
- Missing DB config response (excerpt):
  {
    "ok": false,
    "summary": "Database environment not configured",
    "missingEnv": ["DB_HOST","DB_NAME","DB_USER","DB_PASS"],
    "tips": [
      "Create .env with DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASS and restart the server.",
      "See README: Setup and Troubleshooting to configure PostgreSQL and environment variables."
    ]
  }
- DB error response (excerpt):
  {
    "ok": false,
    "summary": "Database connection error",
    "db": { "available": false, "reason": "error", "message": "password authentication failed for user ..." },
    "tips": [
      "Verify PostgreSQL service is running and reachable at the configured host/port.",
      "Check firewall and credentials (DB_USER/DB_PASS)."
    ]
  }



Enable MFA for a user (from the browser)
- Prerequisites: DB configured and server running (npm start).
- Steps:
  1) Open http://localhost:3000/login
  2) Register a new account (top card) or log in with an existing account via the Login form.
  3) After a successful login, if your account has mfaEnabled=false, an "Enable MFA for your account" card will appear.
  4) Click Start setup. A QR code and a Base32 secret will be shown.
  5) In your authenticator app (Google Authenticator, 1Password, Authy, etc.), add a new TOTP entry by scanning the QR or manually entering the secret.
  6) Enter the current 6-digit code from your app into the page and click Verify & Enable.
  7) On success, MFA is enabled for your account. Future logins will return mfaRequired and you must enter the 6-digit code.

Notes and troubleshooting
- Invalid code (401): TOTP codes rotate every ~30s. Wait for the next window and try again. Ensure your device clock is accurate.
- Already enabled (400 on setup): The account already has MFA. You can disable it via POST /api/auth/mfa/disable (requires a valid code) or from your own admin flow.
- Dev helper: When running locally, set MFA_TEST_MODE=true (and not NODE_ENV=production) to enable GET /api/auth/mfa/dev-code. The login page exposes a "Get test code" button during setup to auto-fill a valid code.
- You can still enable MFA via API using the examples earlier in this README (mfa/setup → mfa/verify).
