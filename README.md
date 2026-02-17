# WhatsApp Web Clone (v1)

1–1 text messaging with real-time delivery, online status, and message persistence.  
See [docs/PRD.md](docs/PRD.md) for scope and requirements.

## Tech stack

- **Frontend:** React (Vite), Axios, Socket.io-client, React Router
- **Backend:** Node.js, Express, Socket.io, JWT, bcrypt
- **Database:** PostgreSQL (Prisma)

## Project structure

```
whatsapp-clone/
├── backend/          # Express API + Socket.io + Prisma
├── frontend/         # React (Vite) app
├── docs/
│   └── PRD.md
└── README.md
```

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL (PostgreSQL) and JWT_SECRET
npx prisma generate
npx prisma db push
npm run dev
```

Server runs at `http://localhost:4000`. Use a local or cloud PostgreSQL instance.

If `npm run dev` fails (e.g. "Could not determine Node.js install directory"), use:
```bash
npm run dev:simple
```
or `node server.js` directly.

### 2. Frontend

```bash
cd frontend
npm install
# Optional: .env with VITE_API_URL (leave empty for dev proxy)
npm run dev
```

App runs at `http://localhost:3080` (or next free port if 3080 is in use). Vite proxies `/api` and `/socket.io` to the backend.

### 3. Usage

1. Open `http://localhost:5173`
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

## Environment

- **Backend:** `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` — see `backend/.env.example`
- **Frontend:** `VITE_API_URL` — leave empty in dev for Vite proxy; set in production to backend URL
