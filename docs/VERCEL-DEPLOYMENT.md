# Deploy WhatsApp Clone: Frontend on Vercel, Backend on Render

This guide walks you through hosting the **frontend** on **Vercel** and the **backend** on **Render**, and fixing CORS so they work together.

---

## What runs where

| Part | Platform | Why |
|------|----------|-----|
| **Frontend** (React + Vite) | **Vercel** | Static/SPA hosting, fast CDN |
| **Backend** (Node + Express + Socket.io + PostgreSQL) | **Render** | Socket.io needs a long-lived server; Vercel serverless cannot hold WebSockets |

The frontend calls the backend using the `VITE_API_URL` env var. The backend must allow the frontend origin via `FRONTEND_URL` for CORS and Socket.io.

---

## Code changes made for two-platform deploy

### 1. Backend CORS (`backend/server.js`)

- **Allowed origins** are now an array: `FRONTEND_URL` (from env) plus `http://localhost:3080` and `http://localhost:5173` for local dev.
- **Express CORS** uses a function so the response includes `Access-Control-Allow-Origin: <request-origin>` when the request origin is in the list. This fixes the error: *"No 'Access-Control-Allow-Origin' header is present"* when `FRONTEND_URL` is set on Render.
- **Methods** include `OPTIONS` so browser preflight (OPTIONS) requests succeed.
- **Socket.io** uses the same allowed-origins list so WebSocket connections from the Vercel app are accepted.

So: set **`FRONTEND_URL`** on Render to your Vercel URL (e.g. `https://whatsapp-clone-pi-ecru.vercel.app`). No trailing slash.

### 2. Frontend (`frontend/`)

- No code changes. The app already uses `import.meta.env.VITE_API_URL` for API and Socket.io.
- Set **`VITE_API_URL`** on Vercel to your Render backend URL (e.g. `https://whatsapp-clone-znde.onrender.com`). No trailing slash.

### 3. `frontend/vercel.json`

- Ensures SPA rewrites and build/output for Vite (already present).

---

## Step-by-step deployment

### Part 1: Deploy backend on Render

1. **Push your code** to GitHub (including the latest `backend/server.js`).

2. **Create a PostgreSQL database**
   - **Render:** Dashboard → **New +** → **PostgreSQL**. Create the database.
   - Copy the **Internal Database URL** (or External if you prefer). You’ll use it as `DATABASE_URL`.

3. **Create a Web Service for the backend**
   - **New +** → **Web Service**.
   - Connect your GitHub repo and select it.
   - Configure:
     - **Name:** e.g. `whatsapp-clone-backend`
     - **Root Directory:** `backend` (important)
     - **Runtime:** Node
     - **Build Command:** leave default or `npm install`
     - **Start Command:** `npm start`
   - Click **Create Web Service**.

4. **Set environment variables (Render)**
   - In the Web Service → **Environment** tab, add:

   | Key | Value |
   |-----|--------|
   | `DATABASE_URL` | Your Postgres connection string from step 2 |
   | `JWT_SECRET` | A long random string (e.g. `openssl rand -hex 32`) |
   | `FRONTEND_URL` | `https://whatsapp-clone-pi-ecru.vercel.app` (your Vercel URL; no trailing slash) |

   - **Save**. Render will redeploy. If you don’t have the Vercel URL yet, you can add `FRONTEND_URL` after Part 2 and redeploy again.

5. **Note the backend URL**
   - After deploy, open the service; the URL is shown at the top (e.g. `https://whatsapp-clone-znde.onrender.com`). Use this for `VITE_API_URL` in Part 2.

---

### Part 2: Deploy frontend on Vercel

1. **Import project**
   - Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
   - Import your GitHub repo.

2. **Configure project**
   - **Root Directory:** set to `frontend` (so only the frontend is built).
   - **Framework Preset:** Vite (auto-detected).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

3. **Environment variable**
   - **Settings** → **Environment Variables**:
   - **Name:** `VITE_API_URL`
   - **Value:** your Render backend URL, e.g. `https://whatsapp-clone-znde.onrender.com` (no trailing slash)
   - Apply to **Production** (and **Preview** if you use it).

4. **Deploy**
   - Click **Deploy**. Wait for the build to finish.
   - Note your frontend URL (e.g. `https://whatsapp-clone-pi-ecru.vercel.app`).

5. **Point backend to frontend (if not done yet)**
   - In **Render** → your Web Service → **Environment**:
   - Set **`FRONTEND_URL`** = `https://whatsapp-clone-pi-ecru.vercel.app` (your actual Vercel URL).
   - Save and let Render redeploy.

---

### Part 3: Verify

1. Open your **Vercel URL** (e.g. `https://whatsapp-clone-pi-ecru.vercel.app`).
2. **Register** or **Login**.
   - You should see no CORS errors in the browser console.
   - Network tab should show `POST https://whatsapp-clone-znde.onrender.com/api/auth/login` (or register) with status 200/201.
3. After login you should see the chat UI; opening a chat and sending messages should work, including real-time updates via Socket.io.

If you still see CORS errors:

- Confirm **Render** env has `FRONTEND_URL` exactly: `https://whatsapp-clone-pi-ecru.vercel.app` (no trailing slash, correct domain).
- Confirm **Vercel** env has `VITE_API_URL` exactly: `https://whatsapp-clone-znde.onrender.com`.
- Redeploy both after changing env vars.

---

## Summary

| Platform | Role | Env vars |
|----------|------|----------|
| **Vercel** | Frontend | `VITE_API_URL` = `https://whatsapp-clone-znde.onrender.com` |
| **Render** | Backend | `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` = `https://whatsapp-clone-pi-ecru.vercel.app` |

Backend code in `server.js` now uses `FRONTEND_URL` in an allowed-origins list so CORS and Socket.io work when frontend and backend are on two different platforms.
