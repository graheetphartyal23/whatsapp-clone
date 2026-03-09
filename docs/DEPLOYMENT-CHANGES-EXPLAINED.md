# Where Changes Were Made, Why, and How They Run

This document lists every deployment-related change in the project: **where** it is, **what** it does, **why** it was added, and **how** it behaves when you run the app locally vs on Vercel + Render.

---

## 1. Backend: Database connection — `backend/lib/db.js`

### What changed

- **Lines 4–8:** Check that `DATABASE_URL` is set; if not, log an error and exit.
- **Lines 9–19:** Use SSL only when the connection string is **not** localhost (so Render Postgres uses SSL; local Postgres can run without SSL).

### Why

- **Missing `DATABASE_URL`** causes confusing 500 errors later. Failing at startup with a clear message makes misconfiguration obvious.
- **Render (and most cloud) Postgres** require SSL. **Local** Postgres often doesn’t use SSL. Conditional SSL lets the same code work in both environments.

### How it runs

| Environment | `DATABASE_URL` example | SSL used? |
|-------------|------------------------|-----------|
| **Local** | `postgresql://...@localhost:5432/...` | No |
| **Render** | `postgresql://...@xxx.render.com/...` | Yes (`rejectUnauthorized: false`) |

If `DATABASE_URL` is missing, the process exits before the server starts.

---

## 2. Backend: Server startup, CORS, Socket.io, port — `backend/server.js`

### What changed

- **Lines 19, 65:** Import and call `initDb(db)` after the DB connection check.
- **Lines 23–28:** CORS with `origin: true` (reflect the request origin).
- **Lines 30–35:** Socket.io with `cors: { origin: '*' }`.
- **Lines 68–70:** `PORT` from env (default 8000); `PORT_EXPLICIT` = “was PORT set by env?”; list of fallback ports.
- **Lines 80–119:** `startServer()`:
  - If **PORT is set** (e.g. on Render): listen only on that port; no fallback.
  - If **PORT not set** (local): try 8000, then 8001–8007 if 8000 is in use.
  - After listening: `SELECT NOW()` to verify DB, then `initDb(db)` to create tables.

### Why

- **CORS / Socket.io:** Frontend (Vercel) and backend (Render) are on different origins. Allowing any origin (or reflecting it) avoids CORS/WebSocket errors without configuring `FRONTEND_URL`.
- **Port:** Render sets `PORT`; the app must use only that. Locally, if 8000 is busy, trying 8001–8007 avoids “address in use” without forcing the user to edit `.env`.
- **initDb:** Render’s free Postgres has no query UI. Running the schema on startup means you never have to run SQL by hand.

### How it runs

| Environment | PORT | Behavior |
|-------------|------|----------|
| **Local** (no `PORT` in .env) | 8000 | Tries 8000; if in use, tries 8001–8007. |
| **Render** | Set by Render (e.g. 10000) | Listens only on that port; no fallback. |

After the server is listening, it connects to the DB and runs the schema (see Section 3).

---

## 3. Backend: Auto schema on startup — `backend/scripts/initDb.js` (new file)

### What it does

- Reads `backend/database-schema.sql`.
- Strips `--` comment lines.
- Splits the rest into SQL statements (by `;\n`).
- Runs each statement with the same `pool` the server uses. Ignores “already exists” errors (e.g. table/index); logs other errors.

### Why

- On Render’s free tier you don’t get a SQL shell. This way the backend creates `users`, `chats`, `chat_members`, and `messages` (and indexes/backfill) on first start, so register/login work without any manual SQL.

### How it runs

- **Every backend start** (local or Render): after “Database connected successfully”, `server.js` calls `initDb(db)`.  
- **First run:** Tables and indexes are created; you see “Database schema initialized (tables ready).”  
- **Later runs:** `CREATE TABLE IF NOT EXISTS` and similar do nothing; “already exists” is ignored; same log line. No duplicate data; safe to run every time.

---

## 4. Frontend: API and Socket URL — multiple files

### Where

All use the same pattern:

- `frontend/src/context/AuthContext.jsx` (line 6)
- `frontend/src/context/SocketContext.jsx` (line 7)
- `frontend/src/pages/Chat.jsx` (line 12)
- `frontend/src/pages/Login.jsx` (line 7)
- `frontend/src/components/Sidebar.jsx` (line 5)
- `frontend/src/components/MessageInput.jsx` (line 6)

Pattern:

```js
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// or
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

### Why

- Vite bakes `VITE_*` env vars into the build. So:
  - **Local:** No (or empty) `VITE_API_URL` → fallback `http://localhost:8000` → frontend talks to your local backend.
  - **Vercel:** You set `VITE_API_URL` to your Render backend URL → all API and Socket.io traffic go to Render.

No hardcoded production URL; one env var controls both HTTP and WebSocket.

### How it runs

| Where you run frontend | `VITE_API_URL` | Result |
|------------------------|----------------|--------|
| **Local** (`npm run dev`) | Not set or `http://localhost:8000` | Requests go to local backend. |
| **Vercel** (deployed build) | Set to `https://your-app.onrender.com` | Requests go to Render backend. |

---

## 5. Frontend: Vercel config — `frontend/vercel.json`

### What it does

- `buildCommand`: `npm run build`
- `outputDirectory`: `dist` (Vite’s default)
- `framework`: `vite`
- `rewrites`: All routes `/(.*)` → `/index.html` (SPA: React Router handles routes in the browser)

### Why

- So Vercel builds the Vite app correctly and serves the SPA without 404s on refresh or direct links.

### How it runs

- Only when you deploy the **frontend** to Vercel (with root directory `frontend`). Not used when you run `npm run dev` locally.

---

## 6. Env examples and docs

### Files

- **`backend/.env.example`** — Documents `DATABASE_URL`, `JWT_SECRET`, optional `PORT` and `FRONTEND_URL`; notes for local vs Render.
- **`frontend/.env.example`** — Documents `VITE_API_URL` for local vs Vercel (Render URL).
- **`docs/VERCEL-DEPLOYMENT.md`** — Step-by-step deploy on free tier (no manual SQL).
- **`README.md`** — “Deploy (Vercel + Render)” section and env summary.

### Why

- So anyone can copy `.env.example` to `.env`, fill values, and know what to set on Render and Vercel without guessing.

---

## 7. End-to-end: how it runs when you use the project

### Local

1. **Backend:** `cd backend && npm run dev`  
   - Loads `backend/.env` → `DATABASE_URL`, `JWT_SECRET`.  
   - Listens on 8000 (or next free port 8001–8007).  
   - Connects to Postgres (no SSL if URL has localhost).  
   - Runs `initDb(db)` → tables exist.  
2. **Frontend:** `cd frontend && npm run dev`  
   - No `VITE_API_URL` (or `http://localhost:8000`) → API and Socket.io use local backend.  
3. You open the app in the browser; register, login, chats, and messages all hit the local backend and DB.

### Deployed (Vercel + Render)

1. **Render Web Service** (root `backend`):  
   - Render sets `PORT` and injects your env (`DATABASE_URL`, `JWT_SECRET`).  
   - Server listens on `PORT`, connects to Render Postgres (with SSL), runs `initDb(db)` so tables exist.  
2. **Vercel** (root `frontend`):  
   - Build uses `VITE_API_URL` = your Render URL → all API and Socket.io go to Render.  
3. User opens the Vercel URL → frontend loads → login/register and real-time features go to the Render backend and Render Postgres.

No code changes are required between local and deployed; only env vars (and, on Vercel, the build-time `VITE_API_URL`).

---

## Quick reference: files touched for deployment

| File | Purpose of change |
|------|-------------------|
| `backend/lib/db.js` | Require `DATABASE_URL`; SSL only for non-localhost. |
| `backend/server.js` | CORS + Socket.io allow cross-origin; port logic (Render vs local); call `initDb(db)` after DB connect. |
| `backend/scripts/initDb.js` | **New.** Run schema on startup so tables exist without manual SQL. |
| `frontend/src/**` (6 files) | Use `VITE_API_URL` with localhost fallback for API and Socket. |
| `frontend/vercel.json` | Vite build and SPA rewrites for Vercel. |
| `backend/.env.example` | Document env vars for local and Render. |
| `frontend/.env.example` | Document `VITE_API_URL` for local and Vercel. |
| `docs/VERCEL-DEPLOYMENT.md` | Full free-tier deploy steps (no query UI). |
| `README.md` | Deploy section and env summary. |
