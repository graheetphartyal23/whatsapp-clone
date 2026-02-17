# Product Requirements Document (PRD) — WhatsApp Web Clone v1

## Scope

### In scope (v1)
- **Web app** (no mobile app)
- **1–1 messaging only** (no groups)
- **Text messages only**
- **Real-time delivery** (WebSockets)
- **Online/offline status**
- **Message persistence** (database)
- **Simple auth** (email + password, JWT)

### Out of scope (v1)
- Voice/video
- Media sharing
- E2E encryption
- Push notifications
- Scale to millions

---

## Feature list

1. **Auth**: Register, Login, JWT, protected routes
2. **Chats**: List user's chats, create chat with another user, open chat
3. **Messages**: Send text, receive in real time, persist in DB
4. **Message status**: Sent → Delivered → Read
5. **Online/offline**: Indicate when a user is connected
6. **Pagination**: Load older messages (cursor-based)

---

## Non-functional requirements

- **Latency**: Messages delivered in real time when recipient is online
- **Reliability**: Messages stored in DB; no loss on refresh
- **Availability**: Single-region deployment (e.g. Render/Railway)

---

## Tech stack

- **Frontend**: React (Vite), Axios, Socket.io-client, React Router
- **Backend**: Node.js, Express, Socket.io
- **Database**: PostgreSQL (Prisma ORM)
- **Deploy**: Docker-ready; Render / Railway / AWS EC2

---

## API summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET | /api/auth/users | List users |
| GET | /api/chats | List chats |
| GET | /api/chats/:id | Get chat |
| GET | /api/chats/:id/messages | Messages (cursor pagination) |
| POST | /api/chats | Create chat (body: `{ userId }`) |
| POST | /api/messages | Send message (body: `{ chatId, content }`) |
| PATCH | /api/messages/:messageId/status | Update status (body: `{ status }`) |

**Socket events**

- `user_online` / `user_offline` (broadcast)
- `send_message` (client → server: `{ chatId, content }`)
- `receive_message` (server → client: message object)
- `message_status_update` (client → server: `{ messageId, status }`; server → sender: same payload)
