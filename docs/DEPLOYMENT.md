# Deployment Guide

## ⚠️ Important: Socket.io Limitation

**Socket.io requires persistent WebSocket connections**, which don't work with Vercel's serverless functions. You **cannot** deploy the backend with Socket.io on Vercel.

---

## ✅ Recommended: Separate Deployment

### Option 1: Frontend on Vercel + Backend on Railway/Render (Recommended)

#### Frontend → Vercel

1. **Build frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repo
   - Set **Root Directory** to `frontend`
   - Add environment variable:
     ```
     VITE_API_URL=https://your-backend-url.railway.app
     ```
   - Deploy

#### Backend → Railway (or Render/Fly.io)

**Railway:**
1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select your repo, set **Root Directory** to `backend`
4. Add environment variables:
   ```
   DATABASE_URL=your_postgresql_url
   JWT_SECRET=your_secret
   FRONTEND_URL=https://your-frontend.vercel.app
   PORT=8000
   ```
5. Deploy

**Render:**
1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo, set **Root Directory** to `backend`
4. Build: `npm install`
5. Start: `npm start`
6. Add environment variables (same as Railway)

---

### Option 2: Both on Railway/Render (Easier, Single Platform)

Deploy both frontend and backend on the same platform:

**Railway:**
1. Deploy backend as a **Web Service**
2. Deploy frontend as a **Static Site** (or separate Web Service)
3. Both share the same project

**Render:**
1. Backend as **Web Service**
2. Frontend as **Static Site**
3. Both in the same account

---

## 📋 Deployment Checklist

### Backend Environment Variables:
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
FRONTEND_URL=https://your-frontend-url
PORT=8000
```

### Frontend Environment Variables:
```
VITE_API_URL=https://your-backend-url
```

---

## 🚫 Why Not Vercel for Backend?

- ✅ Vercel: Great for frontend, static sites, API routes
- ❌ Vercel: **Cannot** support Socket.io WebSockets (serverless limitation)
- ✅ Railway/Render/Fly.io: Support persistent connections, WebSockets, Socket.io

---

## 🔧 Alternative: Remove Socket.io (Not Recommended)

If you must use Vercel for backend, you'd need to:
- Remove Socket.io
- Use polling instead of WebSockets
- This breaks real-time messaging

**Not recommended** - better to use Railway/Render for backend.

---

## 📝 Quick Deploy Commands

### Railway (Backend):
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy backend
cd backend
railway init
railway up
```

### Vercel (Frontend):
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

---

## 🎯 Best Practice

**Deploy separately:**
- Frontend → Vercel (fast, CDN, great for React)
- Backend → Railway/Render (supports WebSockets, persistent connections)

This gives you the best of both worlds!
