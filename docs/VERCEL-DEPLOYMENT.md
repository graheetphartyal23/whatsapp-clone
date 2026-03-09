# Deploy WhatsApp Clone (100% Free): Vercel + Render

Step-by-step guide to host the **frontend on Vercel** and **backend on Render** using only **free** plans. No credit card required for basic tiers. The app is set up so you **never need to run SQL by hand**—even though Render’s free PostgreSQL has no in-dashboard query tool.

---

## What you get on free tier

| Service | Free tier | Limitation / note |
|--------|-----------|--------------------|
| **Vercel** | Yes | Frontend; no serverless time limit for static/SPA. |
| **Render Web Service** | Yes | Backend; **spins down after ~15 min inactivity**; first request after that can take 30–60 s. |
| **Render PostgreSQL** | Yes | DB included; **no SQL shell/query UI in dashboard** on free tier. |

**Solution for “no query tool”:** The backend **creates all tables automatically** when it starts. You do **not** need to run any SQL in Render (or anywhere). Just deploy and set env vars.

---

## What runs where

| Part | Platform |
|------|----------|
| Frontend (React + Vite) | **Vercel** |
| Backend (Node + Express + Socket.io) | **Render** (Web Service) |
| Database (PostgreSQL) | **Render** (PostgreSQL) |

The frontend talks to the backend using the URL you set in `VITE_API_URL`. No code changes are required for deploy; only env vars and the steps below.

---

## Step-by-step deployment

### 1. Push your code to GitHub

- Commit and push this repo (with `backend/` and `frontend/`).
- You will connect both Render and Vercel to this repo.

---

### 2. Create the database on Render (free)

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign in (or create an account).
2. Click **New +** → **PostgreSQL**.
3. Set **Name** (e.g. `whatsapp-clone-db`).
4. Choose **Free** (or the free plan offered).
5. Click **Create Database**.
6. Wait until status is **Available**.
7. Open the database → **Info** (or **Connect**).
8. Copy the **Internal Database URL** (recommended for a Render Web Service in the same account).  
   - You will paste this into the Web Service env as `DATABASE_URL` in step 4.  
   - You do **not** need the “Query” or “Shell” tab; the backend will create tables on first start.

---

### 3. Create the backend Web Service on Render (free)

1. On Render, click **New +** → **Web Service**.
2. Connect your **GitHub** account and select the repo that contains this project.
3. Configure the service:

   | Field | Value |
   |-------|--------|
   | **Name** | e.g. `whatsapp-clone-backend` |
   | **Region** | Pick one (e.g. Oregon). |
   | **Root Directory** | `backend` ← **important** |
   | **Runtime** | Node |
   | **Build Command** | `npm install` (or leave default). |
   | **Start Command** | `npm start` |
   | **Plan** | **Free** |

4. Before creating, open **Environment** (or **Environment Variables**).

   Add:

   | Key | Value |
   |----|--------|
   | `DATABASE_URL` | The **Internal Database URL** you copied from the Postgres service (step 2). |
   | `JWT_SECRET` | A long random string (e.g. run `openssl rand -hex 32` in a terminal and paste the result). |

   Do **not** set `PORT`; Render sets it automatically.

5. Click **Create Web Service**.
6. Wait for the first deploy to finish. The backend will start and **create all DB tables automatically** (no SQL shell needed).
7. Copy the service URL from the top of the page (e.g. `https://whatsapp-clone-backend-xxxx.onrender.com`). You will use this for the frontend in step 5.

**Free tier note:** After ~15 minutes without requests, the service may sleep. The first request after that can take 30–60 seconds.

---

### 4. (Optional) Confirm database tables were created

- You don’t have to do anything if register/login work.
- If you want to confirm: open your backend URL in the browser, e.g.  
  `https://your-backend.onrender.com/`  
  You should see a JSON message like “WhatsApp Clone API is running.” Then try **Register** from the frontend (after step 5). If register/login return 200/201, tables were created by the backend.

---

### 5. Deploy the frontend on Vercel (free)

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New** → **Project** and import the **same** GitHub repo.
3. Configure the project:

   | Field | Value |
   |-------|--------|
   | **Root Directory** | `frontend` ← **important** (click “Edit” and set it). |
   | **Framework Preset** | Vite (usually auto-detected). |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |

4. Open **Environment Variables** and add:

   | Name | Value |
   |------|--------|
   | `VITE_API_URL` | Your Render backend URL from step 3 (e.g. `https://whatsapp-clone-backend-xxxx.onrender.com`) with **no trailing slash**. |

   Apply to **Production** (and **Preview** if you use preview deployments).

5. Click **Deploy** and wait for the build to finish.
6. Open the Vercel URL (e.g. `https://your-project.vercel.app`).

---

### 6. Verify

1. Open your **Vercel** app URL.
2. **Register** a new user (or **Login** if you already registered).
   - If you see “Loading…” and then the chat screen, the backend and DB are working.
   - If the first request is slow, the Render service may have been sleeping (free tier).
3. Open a chat and send a message to confirm real-time and persistence.

---

## If something goes wrong

| Problem | What to do |
|--------|------------|
| **500 on register or login** | Backend could not create tables (e.g. DB connection failed). Check Render **Logs** for the Web Service; ensure `DATABASE_URL` is the **Internal** URL from the same Render account and that the Postgres service is **Available**. Redeploy the Web Service after fixing env. |
| **CORS error in browser** | Backend is set to allow any origin; this is rare. Ensure the frontend is using the **exact** backend URL in `VITE_API_URL` (no trailing slash). Redeploy Vercel after changing env. |
| **“Failed to fetch” / network error** | Backend may be sleeping (free tier). Wait 30–60 s and try again. Or check that `VITE_API_URL` on Vercel matches the Render Web Service URL. |
| **Render has no “Query” or SQL shell** | Normal on free tier. You don’t need it; the backend runs the schema on startup. |

---

## Summary (no code changes)

| Where | What to set |
|-------|-------------|
| **Render** (Web Service) | `DATABASE_URL` = Internal Database URL from Render Postgres; `JWT_SECRET` = random string. Root Directory = `backend`, Start = `npm start`. |
| **Vercel** (Frontend) | `VITE_API_URL` = your Render Web Service URL (no trailing slash). Root Directory = `frontend`. |

You do **not** need to run any SQL yourself. The backend creates the database tables when it starts.

**Alternative (if you prefer or if auto-init fails):** Use the **External** database URL from Render Postgres and run the schema from your machine: `psql "EXTERNAL_URL" -f backend/database-schema.sql`, or use a desktop client (e.g. pgAdmin, DBeaver) with the External URL and run the contents of `backend/database-schema.sql`.
