# How to Run the Project

## Ports (updated to avoid conflicts)

| Service  | Port | URL                    |
|----------|------|------------------------|
| Backend  | 4000 | http://localhost:4000  |
| Frontend | 3080 | http://localhost:3080  |

---

## 1. Start the backend

Open a terminal:

```powershell
cd g:\whatsapp-clone\backend
```

If `npm run dev` works:
```powershell
npm run dev
```

If you see "Could not determine Node.js install directory", use:
```powershell
npm run dev:simple
```
or:
```powershell
node server.js
```

Wait until you see: **Server running on port 4000**.

---

## 2. Start the frontend

Open a **second** terminal:

```powershell
cd g:\whatsapp-clone\frontend
npm run dev
```

Note the URL in the output (e.g. **http://localhost:3080**). If 3080 is in use, Vite will use the next free port (e.g. 3081).

---

## 3. Open the app

In your browser go to the frontend URL (e.g. **http://localhost:3080**).

---

## If the backend won’t start

- **Port 4000 in use:** Set a different port in `backend/.env`, e.g. `PORT=4001`, and update `frontend/vite.config.js` proxy targets to `http://localhost:4001`.
- **Database error:** Fix `DATABASE_URL` in `backend/.env` (correct password, or use a Neon connection string).

## If the frontend won’t start

- Change `port: 3080` in `frontend/vite.config.js` to another port (e.g. `3081`). `strictPort: false` is set so Vite can pick the next free port automatically.
