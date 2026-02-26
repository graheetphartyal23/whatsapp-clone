# Direct Backend Connection – How It Works

The frontend **no longer uses a proxy**. All API and Socket.io requests go **directly from the browser to the backend URL**.

---

## What Changed

### Before (with proxy)
```
Browser → http://localhost:3080/api/auth/login
         → Vite dev server intercepts /api/*
         → Proxy forwards to http://localhost:8000/api/auth/login
         → Backend responds
```
The browser only talked to the frontend origin (3080); Vite proxied to the backend.

### After (direct)
```
Browser → http://localhost:8000/api/auth/login
         → Backend responds
```
The browser sends requests **directly** to the backend (8000). No proxy in between.

---

## Complete Flow (Step by Step)

### 1. User opens the app

- User goes to **http://localhost:3080** in the browser.
- The browser loads the **frontend** (Vite dev server):
  - HTML, JS, CSS from `localhost:3080`.
- The **frontend** is just the UI; it does not serve the API.

---

### 2. Where the backend URL is defined

- Backend base URL is: **`VITE_API_URL`** or default **`http://localhost:8000`**.
- Used in:
  - **AuthContext.jsx** – `GET ${API}/api/auth/me`
  - **Login.jsx** – `POST ${API}/api/auth/login` or `/api/auth/register`
  - **Chat.jsx** – `GET ${API}/api/chats`, `GET ${API}/api/chats/:id/messages`
  - **Sidebar.jsx** – `POST ${API}/api/chats`, etc.
  - **MessageInput.jsx** – `POST ${API}/api/messages`
  - **SocketContext.jsx** – `io(SOCKET_URL)` → connects to same backend URL

So every API call and the Socket.io client use the **same backend base URL** (no proxy).

---

### 3. Login (example: direct call)

1. User enters email/password and clicks Login.
2. Frontend runs:
   ```js
   axios.post('http://localhost:8000/api/auth/login', { email, password })
   ```
3. **Browser** sends:
   - **Request:** From origin `http://localhost:3080` to `http://localhost:8000/api/auth/login`.
   - **CORS:** Backend must allow origin `http://localhost:3080` (your backend already sets `FRONTEND_URL` / CORS for this).
4. **Backend** (Express on port 8000):
   - Receives the request.
   - Validates credentials, returns JWT and user.
5. **Browser** receives the response; frontend saves token and redirects to chat.

No proxy is involved; it’s a direct **3080 → 8000** request.

---

### 4. Socket.io (direct connection)

1. After login, frontend runs:
   ```js
   io('http://localhost:8000', { auth: { token: user.token } })
   ```
2. **Browser** opens a WebSocket (or long polling) to **http://localhost:8000**.
3. **Backend** (same Express server with Socket.io on 8000):
   - Accepts the connection.
   - Validates token and links socket to user.
4. All real-time events (send_message, receive_message, etc.) go **directly** between browser and `localhost:8000`.

Again, no proxy; connection is **direct to the backend**.

---

### 5. Other API calls (chats, messages)

- **Get chats:**  
  `GET http://localhost:8000/api/chats`  
  with header `Authorization: Bearer <token>`

- **Get messages:**  
  `GET http://localhost:8000/api/chats/:id/messages`

- **Send message (REST):**  
  `POST http://localhost:8000/api/messages`  
  with body `{ chatId, content }`

All from the **browser** to **backend** at `VITE_API_URL` (e.g. `http://localhost:8000`). No proxy.

---

## Why CORS is required

- **Frontend:** `http://localhost:3080`
- **Backend:** `http://localhost:8000`

Different origins → browser enforces CORS. The backend must send:

- `Access-Control-Allow-Origin: http://localhost:3080`  
  (or whatever your frontend URL is)

Your backend already does this via:

- `cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3080' })`
- Socket.io `cors: { origin: ... }`

So with **direct** calls, CORS is what allows the browser to accept responses from port 8000.

---

## Summary diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (user visits http://localhost:3080)                    │
│  - Loads HTML/JS/CSS from 3080                                   │
│  - Runs React app                                                │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         │  API (axios)                       │  Socket (io)
         │  e.g. POST /api/auth/login         │  e.g. connect + send_message
         │  GET /api/chats                    │
         ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend http://localhost:8000                                  │
│  - Express routes: /api/auth, /api/chats, /api/messages         │
│  - Socket.io on same server                                      │
│  - CORS allows origin 3080                                      │
└─────────────────────────────────────────────────────────────────┘
```

- **Frontend (3080):** only serves the app; no proxy.
- **Backend (8000):** receives all API and Socket.io traffic **directly** from the browser.

---

## Configuration

- **Frontend:**  
  - `VITE_API_URL` in `.env` (e.g. `http://localhost:8000`).  
  - If not set, the app falls back to `http://localhost:8000` in code.

- **Backend:**  
  - `FRONTEND_URL` in `.env` (e.g. `http://localhost:3080`) for CORS and Socket.io.

So: **no proxy; frontend always talks directly to the backend** using `VITE_API_URL` (or the default), and the full flow is as above.
