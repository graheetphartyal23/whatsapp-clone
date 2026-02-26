# Deploy WhatsApp Clone: Frontend on Vercel, Backend Elsewhere

This app has two parts:

- **Frontend** (React + Vite) → can be hosted on **Vercel**.
- **Backend** (Node + Express + **Socket.io** + PostgreSQL) → **cannot** run on Vercel (Socket.io needs a long-lived server). Host it on **Railway**, **Render**, or similar.

Below: what was changed for Vercel, then step-by-step to get everything running.

---

## Changes made for Vercel

### 1. `frontend/vercel.json` (new)

- **`buildCommand`**: `npm run build` so Vercel runs `vite build`.
- **`outputDirectory`**: `dist` (Vite’s default output).
- **`framework`**: `vite` so Vercel uses Vite defaults.
- **`rewrites`**: All routes `/(.*)` → `/index.html` so React Router works on refresh and direct URLs (SPA).

### 2. Backend stays off Vercel

- The backend uses **Socket.io** (WebSockets). Vercel’s serverless functions are short-lived and cannot hold Socket.io connections.
- So the **backend is not deployed to Vercel**. It is deployed to **Railway** (or Render, etc.), and the frontend on Vercel talks to that backend URL via `VITE_API_URL`.

### 3. Environment variables

- **Frontend (Vercel):** Set `VITE_API_URL` to your **deployed backend URL** (e.g. `https://your-backend.railway.app`). No trailing slash.
- **Backend (Railway etc.):** Set `FRONTEND_URL` to your **Vercel frontend URL** (e.g. `https://your-app.vercel.app`) for CORS and Socket.io. Also set `DATABASE_URL`, `JWT_SECRET`, and `PORT` as needed.

No code changes were required in the app itself; only config (vercel.json) and env vars.

---

## Step-by-step: Host and run on Vercel (and Railway)

### Prerequisites

- Git repo (e.g. GitHub) with this project.
- [Vercel](https://vercel.com) account.
- [Railway](https://railway.app) (or Render) account for the backend.
- A **PostgreSQL** database (Railway Postgres, Neon, Supabase, etc.).

---

### Part A: Deploy the backend (e.g. Railway)

1. **Push your code** to GitHub (if not already).

2. **Create a PostgreSQL database**
   - Railway: New Project → **Add PostgreSQL**. Copy the `DATABASE_URL` from Variables.
   - Or use Neon/Supabase and copy the connection string.

3. **Deploy the backend on Railway**
   - New Project → **Deploy from GitHub** → select your repo.
   - Set **Root Directory** to `backend` (so only the backend folder is built).
   - **Variables** (in Railway dashboard):
     - `DATABASE_URL` = your Postgres connection string.
     - `JWT_SECRET` = a long random string (e.g. from `openssl rand -hex 32`).
     - `PORT` = Railway usually sets this automatically (e.g. `PORT=8000`); if not, set it.
     - **Do not set `FRONTEND_URL` yet** (you’ll set it after the frontend is deployed).
   - Deploy. After deploy, open the generated URL (e.g. `https://your-app.railway.app`) and note it. You may need to enable a **public URL** in Railway (Settings → Networking).

4. **Set `FRONTEND_URL` later**
   - After Part B, set `FRONTEND_URL` on Railway to your Vercel URL (e.g. `https://your-app.vercel.app`) and redeploy so CORS and Socket.io allow the frontend origin.

5. **Run DB migrations** (if you have any)
   - If your app expects tables (users, chats, messages), ensure they exist. You might run migration scripts locally against `DATABASE_URL` or add a release command in Railway that runs migrations.

---

### Part B: Deploy the frontend on Vercel

1. **Import the project on Vercel**
   - Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
   - Import your GitHub repo.

2. **Set Root Directory**
   - In project settings, set **Root Directory** to **`frontend`** (so Vercel builds and deploys only the frontend).

3. **Build and output**
   - Vercel should detect Vite and use:
     - **Build Command:** `npm run build` (or leave default).
     - **Output Directory:** `dist`.
   - If not, set them explicitly. The repo’s `frontend/vercel.json` already specifies these.

4. **Environment variables**
   - In Vercel project → **Settings** → **Environment Variables** add:
     - **Name:** `VITE_API_URL`
     - **Value:** your backend URL from Part A (e.g. `https://your-backend.railway.app`).
     - No trailing slash. Apply to Production (and Preview if you want).

5. **Deploy**
   - Click **Deploy**. Wait for the build to finish.
   - Your app will be at `https://your-project.vercel.app` (or your custom domain).

6. **Fix CORS / Socket.io**
   - In Railway (backend), set **`FRONTEND_URL`** = `https://your-project.vercel.app` (your Vercel URL).
   - Redeploy the backend so it allows this origin for CORS and Socket.io.

---

### Part C: Make sure the app works

1. Open the **Vercel URL** (e.g. `https://your-project.vercel.app`).
2. Register a new user or log in.
   - Requests go to `VITE_API_URL` (your Railway backend).
3. Check:
   - Chats load (REST API).
   - Messages send and appear (Socket.io). If messages don’t update in real time, check that `FRONTEND_URL` is set correctly on the backend and that the backend URL is reachable (no firewall blocking it).
4. (Optional) Open the app in two browsers (or incognito) with two users to test chat and presence.

---

## Summary

| What        | Where    | Important env vars                          |
|------------|----------|---------------------------------------------|
| Frontend   | Vercel   | `VITE_API_URL` = backend URL                |
| Backend    | Railway  | `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (Vercel URL), `PORT` if needed |

**Changes in the repo:**

- **Added:** `frontend/vercel.json` — build command, output directory, and SPA rewrites so the app runs correctly on Vercel from the start.

No other code changes were required; deployment is handled by config and environment variables.
