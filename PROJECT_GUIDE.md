# Veritas E-Vote Project Guide

This document describes everything implemented so far in the e-voting project.

## Project Location

```text
cc/evoting-frontend/
```

## Source Code

### Frontend

- `src/App.jsx`
  - Login form
  - Administrator and student role selection
  - Password visibility toggle
  - API authentication
  - MFA verification screen
  - Biometric verification screen
  - Student ballot
  - Vote receipt
  - Administrator dashboard
  - Logout flow

- `src/App.css`
  - Login design
  - Verification screens
  - Student ballot cards
  - Vote receipt
  - Admin dashboard
  - Responsive mobile layout

- `src/index.css`
  - Global font, reset, and page defaults

- `src/main.jsx`
  - React application entry point

### Backend

- `server.js`
  - Node HTTP authentication server
  - Password hashing with `scrypt`
  - Login sessions
  - MFA verification
  - Biometric verification handoff
  - Election candidate data
  - Vote validation
  - One-vote-per-student protection
  - Hash-chained vote ledger
  - Admin dashboard data

### Configuration

- `package.json`
  - Project scripts and dependencies

- `vite.config.js`
  - React plugin
  - `/api` proxy from Vite port 5173 to backend port 4000

- `postcss.config.js`
  - Local PostCSS configuration

- `index.html`
  - Browser entry page

## Install and Run

Open two PowerShell windows.

### Terminal 1: Backend

```powershell
cd "c:\Users\sejal iraskar\OneDrive\Desktop\cc\evoting-frontend"
npm install
npm run server
```

Backend URL:

```text
http://localhost:4000
```

### Terminal 2: Frontend

```powershell
cd "c:\Users\sejal iraskar\OneDrive\Desktop\cc\evoting-frontend"
npm run dev
```

Frontend URL:

```text
http://localhost:5173/
```

Keep the backend terminal open while using the website. If it exits, run `npm run server` again.

## Demo Accounts

### Student

```text
Role: Student voter
ID: BT240041IT
Password: Student@123
MFA code: 240041
```

### Administrator

```text
Role: Administrator
ID: admin-001
Password: Admin@123
MFA code: 240041
```

The biometric screen is currently a local demo handoff. Press `Use device biometric` to continue.

## API Routes

### Health

```http
GET /api/health
```

Returns backend status.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "role": "student",
  "identity": "BT240041IT",
  "password": "Student@123"
}
```

Returns a temporary session token and starts the MFA step.

### MFA

```http
POST /api/auth/mfa
Authorization: Bearer SESSION_TOKEN
Content-Type: application/json

{
  "code": "240041"
}
```

### Biometric verification

```http
POST /api/auth/biometric
Authorization: Bearer SESSION_TOKEN
Content-Type: application/json

{
  "method": "platform"
}
```

### Student election

```http
GET /api/election
Authorization: Bearer SESSION_TOKEN
```

Requires a verified student session.

### Cast vote

```http
POST /api/election/vote
Authorization: Bearer SESSION_TOKEN
Content-Type: application/json

{
  "candidateId": "maya-committee"
}
```

A verified student can cast only one vote. A second attempt returns HTTP `409`.

### Admin dashboard

```http
GET /api/admin/dashboard
Authorization: Bearer SESSION_TOKEN
```

Requires a verified administrator session. Returns anonymous totals, ledger verification status, and recent blocks.

## Current In-Memory Data

There is currently no SQLite, MongoDB, PostgreSQL, or MySQL database configured.

The backend stores these values in memory:

```text
credentials    Demo users and password hashes
sessions       Temporary authentication sessions
 e lection      Election title, status, closing time, and candidates
ledger         Hash-chained vote blocks
```

These values are declared in `server.js` and reset whenever the backend restarts.

## Ledger Design

Each vote block contains:

```text
index
voteId
candidateId
timestamp
voterHash
previousHash
hash
```

The block hash is calculated from the previous hash and the vote data using SHA-256. The admin endpoint recalculates the chain and returns `verified: true` when the chain is intact.

The voter identity is hashed before it is stored in the ledger. The admin dashboard does not receive the original student ID.

## Validation Commands

```powershell
npm run build
npm run lint
node --check server.js
```

The complete flow was tested successfully:

```text
Login -> MFA -> biometric -> student ballot -> vote receipt -> admin dashboard
```

Duplicate voting was also tested and rejected with HTTP `409`.

## Important Production Limitations

This is a working local demonstration, not a production election system yet.

1. The database is in memory and must be replaced with persistent storage.
2. Demo passwords and MFA code are in the source and must be replaced with environment secrets.
3. Sessions should use secure, expiring server-side tokens or signed cookies.
4. Biometric verification should use WebAuthn with real challenge and credential validation.
5. The local hash chain should be replaced or anchored to a real permissioned blockchain.
6. HTTPS, rate limiting, audit logging, backups, access control, and election governance are required before real use.
