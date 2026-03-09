# WhatsApp Web Clone (v1)

1–1 text messaging with real-time delivery, online status, and message persistence.  
See [docs/PRD.md](docs/PRD.md) for scope and requirements.

## Tech stack

- **Frontend:** React (Vite), Axios, Socket.io-client, React Router
- **Backend:** Node.js, Express, Socket.io, JWT, bcrypt
- **Database:** PostgreSQL (node-pg)

## Project structure

```
whatsapp-clone/
├── backend/          # Express API + Socket.io + PostgreSQL
├── frontend/         # React (Vite) app
├── docs/
│   └── PRD.md
└── README.md
```

## Setup

### 1. Database

Create a PostgreSQL database, then run the schema once (e.g. with psql or your DB client):

```bash
psql "YOUR_DATABASE_URL" -f backend/database-schema.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET
npm run dev
```

Server runs at `http://localhost:8000`. If that port is in use, it will try 8001, 8002, etc.; if so, set `VITE_API_URL=http://localhost:PORT` in `frontend/.env`. Use `npm run dev:simple` or `node server.js` to run without file watch.

### 3. Frontend

```bash
cd frontend
npm install
# Optional: .env with VITE_API_URL (leave empty for dev proxy)
npm run dev
```

App runs at `http://localhost:3080` (or next free port). Set `VITE_API_URL=http://localhost:8000` in `frontend/.env` so it talks to the backend.

### 4. Usage

1. Open the URL Vite prints (e.g. `http://localhost:3080`)
2. Register or log in
3. Search/click to start a chat with another user
4. Send text messages (real-time); use “Load older messages” to paginate

## Features (v1)

- User registration and login (JWT)
- 1–1 text messaging (Socket.io + REST)
- Chat list with last message preview
- Online/offline status
- Message status: sent → delivered → read
- Cursor-based pagination for messages
- WhatsApp-like dark UI

## API overview

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/users`
- **Chats:** `GET /api/chats`, `GET /api/chats/:id`, `GET /api/chats/:id/messages?limit=&cursor=`, `POST /api/chats` (body: `{ userId }`)
- **Messages:** `POST /api/messages` (body: `{ chatId, content }`), `PATCH /api/messages/:messageId/status` (body: `{ status }`)

**Socket events:** `user_online`, `user_offline`, `send_message`, `receive_message`, `message_status_update`

## Deploy (Vercel + Render)

To host the frontend on **Vercel** and the backend on **Render** (free tier), follow **[docs/VERCEL-DEPLOYMENT.md](docs/VERCEL-DEPLOYMENT.md)**. The repo is already configured; the backend creates DB tables on startup, so you only need to set env vars. For a breakdown of what was changed and why, see **[docs/DEPLOYMENT-CHANGES-EXPLAINED.md](docs/DEPLOYMENT-CHANGES-EXPLAINED.md)**.

## Environment

- **Backend:** `DATABASE_URL`, `JWT_SECRET` — see `backend/.env.example`
- **Frontend:** `VITE_API_URL` — e.g. `http://localhost:8000` in dev; set to your Render backend URL in production (Vercel)
