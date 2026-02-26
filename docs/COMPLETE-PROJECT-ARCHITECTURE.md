# WhatsApp Clone – Complete Project Architecture & Internal Working

This document explains the entire project from a senior software engineer and system architect perspective: architecture, startup flow, frontend/backend/database, message flow, auth, real-time system, and file-by-file purpose.

---

# PART 1: PROJECT OVERVIEW

## What This Project Is

A **1-to-1 real-time chat application** (WhatsApp-like) where:

- Users register and log in with email/password.
- Users see a list of chats and can start new chats with other users.
- Messages are sent and received in **real time** (no refresh).
- Message status (sent / delivered / read) is supported.
- Online/offline presence is shown.

## What Problem It Solves

- **Real-time communication** without polling: messages appear instantly for the receiver.
- **Persistent storage**: messages and users are stored in a database so history survives refresh and server restart.
- **Auth and security**: only logged-in users can chat; APIs are protected with JWT.

## Technologies Used

| Layer      | Technology   | Purpose |
|-----------|--------------|--------|
| Frontend  | React (Vite) | UI, state, routing |
| HTTP client | Axios    | REST API calls (auth, chats, messages) |
| Real-time | Socket.io-client | WebSocket connection for live messages and presence |
| Routing  | React Router | URLs: `/login`, `/` (chat) |
| Backend   | Node.js + Express | REST API + WebSocket server |
| Real-time (server) | Socket.io | Handle connections, emit events to specific users |
| Database  | PostgreSQL    | Users, chats, messages |
| DB access | `pg` (node-postgres) | Raw SQL, connection pool |
| Auth      | JWT + bcrypt | Login, token generation, password hashing |

## Why Each Technology Was Chosen

- **React + Vite**: Fast dev experience, component-based UI, easy state and event handling.
- **Socket.io**: Built-in reconnection, rooms (per-user), and fallback (WebSocket + polling); fits “send to one user” and “broadcast online/offline.”
- **Express**: Simple routing and middleware; integrates easily with Socket.io on the same HTTP server.
- **PostgreSQL**: Reliable, supports relations (users → chats → messages), good for production.
- **JWT**: Stateless auth; frontend sends token in header; backend verifies without server-side session store.
- **bcrypt**: Standard for hashing passwords so plain passwords are never stored.

## How Frontend, Backend, and Database Interact

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER (Frontend – React)                                              │
│  - Renders UI (Login, Chat list, Message list, Input)                    │
│  - Sends HTTP: POST/GET to backend (Axios)                               │
│  - Holds WebSocket: Socket.io client → backend                           │
│  - Reads/writes: localStorage (JWT token)                                │
└─────────────────────────────────────────────────────────────────────────┘
         │                                      │
         │  HTTP (REST)                          │  WebSocket (Socket.io)
         │  /api/auth, /api/chats, /api/messages │  send_message, receive_message,
         │  + Authorization: Bearer <token>     │  user_online, user_offline
         ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BACKEND (Node.js + Express + Socket.io)                                 │
│  - Validates JWT (auth middleware / Socket middleware)                  │
│  - Runs route handlers (controllers)                                     │
│  - Runs Socket handlers (send_message, etc.)                            │
│  - Talks to database for every read/write                                │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │  SQL over TCP (pg driver)
         │  SELECT/INSERT/UPDATE on users, chats, messages
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DATABASE (PostgreSQL)                                                   │
│  - users, chats, messages tables                                        │
│  - Persists users, chat relationships, message history                   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Frontend → Backend**: REST for auth, chat list, message list, create chat, create message (optional). Socket.io for real-time send/receive and presence.
- **Backend → Database**: Every relevant action (login, load chats, load messages, send message, update status) runs SQL via `pg` (connection pool in `lib/db.js`).

---

# PART 2: PROJECT STARTUP FLOW

## 2.1 Backend: `npm run dev` (backend)

**Command:** `npm run dev` in `backend/` runs `node --watch server.js`.

### What file starts first

- **Entry:** `backend/server.js`.
- Node loads it as an ES module (`"type": "module"` in `package.json`).

### Execution order inside `server.js`

1. **`import 'dotenv/config'`**  
   Loads `.env` into `process.env` (PORT, DATABASE_URL, JWT_SECRET, FRONTEND_URL).

2. **`import { db } from './lib/db.js'`**  
   - Loads `lib/db.js`, which creates a `pg.Pool` with `process.env.DATABASE_URL`.
   - The pool does **not** open a physical connection yet; that happens on first `db.query()`.

3. **`process.on('uncaughtException', ...)` and `process.on('unhandledRejection', ...)`**  
   Global handlers so uncaught errors and rejected promises are logged (and process exits on uncaught).

4. **`import express from 'express'`**  
   Express is the HTTP framework.

5. **`const app = express()`**  
   Creates the Express app (request handler pipeline).

6. **`const httpServer = createServer(app)`**  
   Node’s `http.createServer(app)` creates an HTTP server. Every HTTP request is passed to `app`. This same `httpServer` is later used by Socket.io so HTTP and WebSocket share one port.

7. **`const io = new Server(httpServer, { cors: { origin: FRONTEND_URL, ... } })`**  
   Socket.io attaches to `httpServer`. It listens for upgrade requests (WebSocket) and handles them; normal HTTP still goes to Express. CORS is set so the frontend origin (e.g. `http://localhost:3080`) can connect.

8. **`app.use(cors(...))`**  
   CORS middleware allows the frontend origin to call the API from the browser.

9. **`app.use(express.json())` and `express.urlencoded(...)`**  
   Parse JSON and form bodies into `req.body`.

10. **`app.use((req, res, next) => { req.io = io; next(); })`**  
    Attaches the Socket.io server to every request so controllers can do `req.io.to(userId).emit(...)` (e.g. when creating a message via REST).

11. **`app.get('/', ...)`**  
    Health/info route: returns JSON with API message and endpoints.

12. **`app.use('/api/auth', authRoutes)`**  
    All routes under `/api/auth` (e.g. `/api/auth/login`) are handled by `authRoutes`.

13. **`app.use('/api/chats', chatRoutes)`**  
    All routes under `/api/chats` (e.g. `/api/chats`, `/api/chats/:id/messages`) are handled by `chatRoutes`.

14. **`app.use('/api/messages', messageRoutes)`**  
    All routes under `/api/messages` (e.g. `POST /api/messages`) are handled by `messageRoutes`.

15. **`app.use((err, req, res, next) => ...)`**  
    Central error handler: responds with JSON and status code.

16. **`setupSocketHandlers(io)`**  
    Registers Socket.io middleware and event handlers (see Part 4 and Part 8).

17. **`const PORT = process.env.PORT || 8000`**  
    Port comes from `.env` or defaults to 8000.

18. **`httpServer.listen(PORT, async () => { ... })`**  
    - Binds the HTTP server (and thus Express + Socket.io) to `PORT`.
    - Callback runs after bind. It runs `await db.query('SELECT NOW()')` to **create the first real DB connection** and logs “Database connected successfully” or an error.
    - No request is served until `listen()` has been called.

19. **`.on('error', (err) => ...)`**  
    If `listen()` fails (e.g. port in use), logs and exits.

### Ports and listeners

- **One TCP port:** e.g. **8000**.
- **One HTTP server** handling:
  - Normal HTTP → Express (all `/api/*` and `/`).
  - WebSocket upgrade → Socket.io (path `/socket.io` by default).

So: one process, one port, two “worlds” (REST + Socket.io) on the same server.

---

## 2.2 Frontend: `npm run dev` (frontend)

**Command:** `npm run dev` in `frontend/` runs `vite`.

### How Vite starts

- Vite reads `vite.config.js` (and optionally `.env`).
- It starts an HTTP dev server (default port 3080 from config) and serves:
  - `index.html` at `/`
  - JS/CSS from `src/` (transformed on the fly, no proxy in this project).
- The browser loads `http://localhost:3080` and gets `index.html`.

### How React loads

- `index.html` has: `<script type="module" src="/src/main.jsx"></script>`.
- Browser requests `/src/main.jsx`; Vite compiles it and dependencies (React, ReactDOM, Router, App, etc.) and returns a bundle (or ESM graph).
- Execution starts in `main.jsx`.

### main.jsx

- Imports React, ReactDOM, `BrowserRouter`, `App`, and `index.css`.
- **`ReactDOM.createRoot(document.getElementById('root'))`** finds the `<div id="root">` from `index.html` and creates the React 18 root.
- **`.render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>)`**:
  - Renders the tree once.
  - `BrowserRouter` uses the browser URL (e.g. `/` or `/login`) and provides routing context.
  - `App` is the root component.

### App.jsx

- **`<AuthProvider>`** wraps everything. It holds global auth state (user, loading) and methods (login, logout), and optionally restores user from `localStorage` token via `GET /api/auth/me`.
- **`<AppRoutes>`** (inside AuthProvider) defines:
  - **`<Route path="/login" element={<Login />}>`** – Login page when URL is `/login`.
  - **`<Route path="/" element={<PrivateRoute>...</PrivateRoute>}>`** – For `/`, PrivateRoute runs:
    - If still loading auth → show “Loading...”.
    - If no user → `<Navigate to="/login" replace />`.
    - If user exists → render `<SocketProvider><Chat /></SocketProvider>`.
  - **`<Route path="*" element={<Navigate to="/" replace />}>`** – Catch-all to `/`.

So:

- First paint: AuthProvider may run “restore session” (GET /api/auth/me). Until that finishes, PrivateRoute may show “Loading...” or redirect to `/login`.
- Once user is set, `/` renders SocketProvider and Chat. SocketProvider opens the Socket.io connection to the backend (using `VITE_API_URL`).

### Component rendering

- React renders top-down: App → AuthProvider → AppRoutes → either Login or PrivateRoute → (if logged in) SocketProvider → Chat.
- Chat renders Sidebar, ChatWindow (if a chat is selected), and MessageInput. Each component subscribes to state (e.g. `chats`, `messages`, `user`) and socket events, and re-renders when that state or those events change.

---

# PART 3: FRONTEND ARCHITECTURE

## Folder structure (frontend)

```
frontend/
├── index.html              # Entry HTML; loads /src/main.jsx
├── vite.config.js          # Vite config (port 3080, no proxy)
├── src/
│   ├── main.jsx            # React root: createRoot, render App in BrowserRouter
│   ├── App.jsx             # AuthProvider, routes (Login, PrivateRoute → Chat)
│   ├── index.css            # Global styles (variables, base styles)
│   ├── context/
│   │   ├── AuthContext.jsx  # user, login, logout, restore from token
│   │   └── SocketContext.jsx # Socket.io client instance for logged-in user
│   ├── pages/
│   │   ├── Login.jsx        # Login/register form, submit → API, then navigate to /
│   │   └── Chat.jsx         # Layout: Sidebar + Chat area + MessageInput; state for chats, messages, socket
│   └── components/
│       ├── Sidebar.jsx      # User info, chat list, “new chat” user list
│       ├── ChatWindow.jsx   # Header (other user), message list, load older
│       └── MessageInput.jsx # Textarea + Send; emit send_message or POST /api/messages
```

## Purpose of each file (high level)

- **main.jsx**: Mount React app and wrap with Router.
- **App.jsx**: Auth boundary and route definitions (public Login vs protected Chat).
- **AuthContext**: Holds `user`, `loading`, `login`, `logout`; restores session from token; used by Login and PrivateRoute.
- **SocketContext**: Creates one `io(API_URL, { auth: { token } })` when user exists; provides `socket` to Chat and children.
- **Login.jsx**: Form and submit handler; on success calls `login(data)` and `navigate('/')`.
- **Chat.jsx**: Fetches users and chats (REST); keeps `chats`, `messages`, `selectedChat`; subscribes to socket events; passes props to Sidebar, ChatWindow, MessageInput.
- **Sidebar**: Renders chat list and “new chat” user list; start chat = POST /api/chats; selects chat by calling `onSelectChat`.
- **ChatWindow**: Renders messages, listens for `receive_message` and `message_status_update`; marks as delivered when receiving; scrolls to bottom.
- **MessageInput**: Send = `socket.emit('send_message', { chatId, content })` (or fallback POST /api/messages); Enter key triggers send.

## Components in detail

### Sidebar

- **Props:** user, chats, users, loadingChats, selectedChat, onSelectChat, onChatsUpdate, onLogout.
- **State:** showNewChat, search (for filtering users).
- **Behavior:** Displays current user and logout; either chat list or “new chat” user list. Clicking a user in “new chat” calls `POST /api/chats` with `userId`, then onSelectChat with the returned chat. Clicking a chat calls onSelectChat(chat). Chats show last message and time; “other” user is derived from `chat.otherUser`.

### ChatWindow

- **Props:** otherUser, messages, loading, currentUserId, nextCursor, loadingMore, onLoadOlder, onNewMessage, onStatusUpdate.
- **Behavior:** Renders header (other user, online status), message list (own vs other by sender id), and “Load older messages” when nextCursor exists. Subscribes to `receive_message` (calls onNewMessage and may emit `message_status_update` for delivered) and `message_status_update` (calls onStatusUpdate). Scrolls bottom ref into view when messages change.

### MessageInput

- **Props:** chatId, onMessageSent.
- **State:** text (textarea), sending.
- **Behavior:** On Send (or Enter): trims text, clears text, then either `socket.emit('send_message', { chatId, content })` or `POST /api/messages` with same payload. No proxy: request goes to `VITE_API_URL` (e.g. http://localhost:8000).

### Login page

- **State:** isRegister, name, email, password, error, loading.
- **Behavior:** Submits to `/api/auth/register` or `/api/auth/login` (base URL from env or default). On success: `login(data)` (sets user + token in context and localStorage), then `navigate('/', { replace: true })`. On failure: set error message.

## React rendering and state

- **Rendering:** Parent state (e.g. Chat’s `chats`, `messages`, `selectedChat`) flows down as props. When state updates (setState or context), React re-renders the subtree that depends on it.
- **State:** Chat.jsx holds most UI state (chats, messages, selectedChat, loading flags). Auth state is in AuthContext; socket instance in SocketContext. Sidebar and MessageInput have local state (e.g. text, showNewChat).
- **Events:** Click and input handlers call setState or callbacks (onSelectChat, onNewMessage, etc.). Socket events are subscribed in useEffect and call those callbacks or setState, triggering re-renders.

---

# PART 4: BACKEND ARCHITECTURE

## server.js flow (conceptual, line by line)

- **dotenv/config**: Load env.
- **db**: Import pool; used later for DB check and in all controllers/socket handlers.
- **process.on('uncaughtException' / 'unhandledRejection')**: Log and exit or log.
- **express()**: Create app.
- **createServer(app)**: HTTP server that uses Express for HTTP requests.
- **new Server(httpServer, { cors })**: Socket.io attaches to same server; CORS allows frontend origin.
- **app.use(cors(...))**: CORS for REST.
- **app.use(express.json()), urlencoded**: So `req.body` is populated.
- **app.use((req, res, next) => { req.io = io; next(); })**: So any route can emit to a user via `req.io.to(userId).emit(...)`.
- **app.get('/')**: Serves API info JSON.
- **app.use('/api/auth', authRoutes)**: Routes like POST /api/auth/login, GET /api/auth/me, etc.
- **app.use('/api/chats', chatRoutes)**: GET/POST /api/chats, GET /api/chats/:id/messages, GET /api/chats/:id.
- **app.use('/api/messages', messageRoutes)**: POST /api/messages, PATCH /api/messages/:messageId/ status.
- **app.use(err handler)**: Sends JSON error response.
- **setupSocketHandlers(io)**: Registers Socket middleware and events.
- **httpServer.listen(PORT, callback)**: Bind port; callback runs DB ping and logs.

## How Express works

- Each `app.use(path, router)` mounts a router. Incoming URL is matched; if prefix matches, the router’s handlers are tried (e.g. `router.post('/login', login)` matches POST /api/auth/login).
- Middleware and route handlers get (req, res, next). They read req.body, req.params, req.headers; they call res.json() or res.status().json(); or next(err) for the error handler.

## How routes work

- **authRoutes**: POST /register → register, POST /login → login, GET /me → protect then getMe, GET /users → protect then getUsers.
- **chatRoutes**: All under /api/chats; `router.use(protect)` so every chat route requires JWT. Then GET / → getChats, GET /:id/messages → getChatMessages, GET /:id → getChatById, POST / → createChat.
- **messageRoutes**: All under /api/messages; protect; POST / → createMessage, PATCH /:messageId/status → updateMessageStatus.

## How controllers work

- Controllers are async (req, res). They read req.user (set by protect), req.body, req.params, req.query. They call `db.query(...)` for DB work, then `res.json(...)` or `res.status(...).json(...)`. createMessage also does `req.io.to(recipientId).emit('receive_message', message)` so the receiver gets the message in real time when sent via REST.

## How Socket.io works internally (backend)

- **Attachment:** Socket.io listens on the same HTTP server. When a request comes for path `/socket.io` (and upgrade), it handles it and keeps a long-lived connection (WebSocket or polling).
- **Middleware:** `io.use((socket, next) => { ... })` runs first. It reads `socket.handshake.auth.token`, verifies JWT, sets `socket.userId`, then next(). If verification fails, next(error) and the connection is rejected.
- **connection:** When a client connects, the server runs `io.on('connection', (socket) => { ... })`. Inside:
  - `socket.join(socket.userId)`: Puts this socket in a room named by user id. Later, `io.to(userId).emit(...)` sends only to that user’s sockets.
  - `socket.broadcast.emit('user_online', { userId })`: Tells all other clients “this user is online.”
  - `socket.on('send_message', async (payload) => { ... })`: Validates chat, inserts message in DB, then `io.to(recipientId).emit('receive_message', message)` and `socket.emit('receive_message', message)` so both receiver and sender get the message.
  - `socket.on('message_status_update', ...)`: Updates message status in DB and emits to sender.
  - `socket.on('disconnect', ...)`: Broadcasts `user_offline` for this userId.

So: one process, one HTTP server, one Socket.io server; routes handle REST, Socket handlers handle real-time; both use the same `db` and same `io` for targeting users by room.

---

# PART 5: DATABASE FLOW

## How the database connects

- **lib/db.js** creates a `new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: ... })`. No connection is opened until the first query. When you call `db.query('SELECT NOW()')` in the listen callback, the pool opens a connection to PostgreSQL, runs the query, and returns. So “database connected” in the log means “at least one connection works.”

## Schemas (tables)

- **users:** id (UUID), email (unique), password_hash, name, created_at.
- **chats:** id (UUID), user1_id, user2_id (both FK to users), created_at; unique on (user1_id, user2_id) with a canonical order (e.g. user1_id < user2_id).
- **messages:** id (UUID), chat_id (FK chats), sender_id (FK users), content, status ('sent'|'delivered'|'read'), created_at.

Indexes (conceptually): unique on users(email); unique on chats(user1_id, user2_id); index on messages(chat_id, created_at) for listing messages in a chat.

## How users are stored

- **Register:** Controller hashes password with bcrypt, generates UUID for id, runs INSERT into users, returns user + JWT. No Prisma: raw `db.query('INSERT INTO users ...')`.
- **Login:** SELECT user by email; compare password with bcrypt.compare; return user + JWT.

## How messages are stored

- **Send (Socket):** Socket handler gets chatId and content; verifies chat belongs to sender; INSERT into messages with id, chat_id, sender_id, content, status 'sent', created_at; then emit to recipient and sender.
- **Send (REST):** createMessage controller does the same INSERT and then `req.io.to(recipientId).emit('receive_message', message)` so the receiver gets it in real time.
- **Load messages:** getChatMessages runs SELECT on messages for that chat_id (and checks user is in chat), with ORDER BY created_at DESC and LIMIT/cursor for pagination; returns list to frontend.

## How chats are stored

- **Create chat:** createChat ensures user1_id < user2_id (canonical order), does SELECT for existing chat; if none, INSERT into chats; returns chat with otherUser.
- **Get chats:** getChats SELECTs chats where user1_id or user2_id is current user, joins users for both sides, and for each chat runs another query for last message; returns array of { id, otherUser, lastMessage, createdAt }.

So: every “save” is an INSERT or UPDATE via `db.query`; every “read” is a SELECT. No ORM; all SQL in controllers and socket handlers.

---

# PART 6: COMPLETE MESSAGE FLOW (USER A SENDS → USER B SEES)

## User A: types message and clicks Send

**Frontend (MessageInput):**

1. User types in textarea; React state `text` holds the value.
2. User clicks Send (or presses Enter without Shift).
3. `sendMessage()` runs:
   - Trims text; if empty or no chatId, return.
   - `setText('')` (clear input).
   - `setSending(true)`.
   - Payload = `{ chatId, content: trimmed }`.
   - If socket exists: `socket.emit('send_message', payload)` then `setSending(false)`. No REST call.
   - If no socket: `axios.post(API + '/api/messages', payload, { headers: { Authorization: 'Bearer ' + token } })` then on response calls `onMessageSent(res.data)` and `setSending(false)`.

**If sent via Socket (typical):**

4. Socket.io client sends the event `send_message` with payload over the WebSocket to the backend.

**Backend (Socket handler):**

5. Server receives `send_message` on the sender’s socket.
6. Validates chatId and content; loads chat from DB (and checks sender is participant).
7. Generates message id (e.g. crypto.randomUUID()), INSERTs into messages (id, chat_id, sender_id, content, status 'sent', created_at).
8. Loads sender user for name/email.
9. Builds message object { id, chatId, senderId, content, status, createdAt, sender }.
10. Computes recipientId (the other user in the chat).
11. `io.to(recipientId).emit('receive_message', message)` – sends to the room named by recipient’s user id (so User B’s tab).
12. `socket.emit('receive_message', message)` – sends back to the sender’s socket (so User A’s tab gets the same message object for consistency).

**User A’s frontend (Chat.jsx + ChatWindow):**

13. Chat.jsx has subscribed to `receive_message` and passes `onNewMessage` to ChatWindow. So when the server emits `receive_message` to the sender, the sender’s socket receives it and calls `onNewMessage(message)`.
14. `onNewMessage` in Chat.jsx: if the message’s chatId is the selected chat, it appends the message to `messages` state; it also updates the chat list’s lastMessage for that chat. React re-renders.
15. ChatWindow’s message list is driven by `messages`; the new message appears in User A’s view.

**User B’s frontend (receiver):**

16. User B’s socket is in the room `recipientId` (User B’s userId). So when the server did `io.to(recipientId).emit('receive_message', message)`, User B’s client receives the event.
17. Same subscription in Chat.jsx: `socket.on('receive_message', onNewMessage)`. So User B’s `onNewMessage(message)` runs.
18. Again, if the message’s chatId is User B’s selected chat, messages state is updated; otherwise only chat list’s lastMessage updates. Either way, React re-renders and the message appears (or the chat list shows the new last message).
19. ChatWindow may also emit `message_status_update` (e.g. delivered) when the receiver gets a message that’s not from themselves; backend updates DB and emits to sender so User A can see “delivered.”

So end-to-end: click Send → emit or POST → backend validates, INSERT, emit to recipient (and sender) → both UIs update from socket handler and state update.

---

# PART 7: AUTHENTICATION FLOW

## User registers

1. Frontend: POST /api/auth/register with { name, email, password }.
2. Backend: register controller checks email not already in users; hashes password (bcrypt); INSERT user; generates JWT (payload { id: user.id }, expires 30d); returns { id, name, email, createdAt, token }.
3. Frontend: login(data) stores user and token in context and localStorage; navigate to /.

## User logs in

1. Frontend: POST /api/auth/login with { email, password }.
2. Backend: SELECT user by email; bcrypt.compare(password, user.password_hash); if match, generate JWT and return same shape { ...user, token }.
3. Frontend: same as register – login(data), navigate to /.

## JWT generation

- Backend: `jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' })`. Token is a signed string; no DB write for token storage.

## Token storage

- Frontend: After login/register, `localStorage.setItem('token', userData.token)`. Every subsequent API call sends `Authorization: Bearer <token>`. Socket connects with `auth: { token }`.

## Token verification

- **REST:** authMiddleware (protect) reads `Authorization` header, extracts token, `jwt.verify(token, JWT_SECRET)` to get decoded.id; then SELECT user by id and set req.user; if any step fails, 401.
- **Socket:** Socket middleware reads `socket.handshake.auth.token`, same verify, sets socket.userId; if invalid, next(error) and connection is rejected.

So: one token type (JWT), used for both HTTP and Socket.io; verified on every protected route and on every Socket connection.

---

# PART 8: REAL-TIME SYSTEM FLOW (SOCKET.IO IN DETAIL)

## How connection works

1. Frontend (SocketContext): When user (and token) exist, it runs `io(API_URL, { auth: { token: user.token } })`. API_URL is e.g. http://localhost:8000.
2. Browser opens a connection to that origin (WebSocket or long polling). Socket.io server receives the connection and runs the `io.use` middleware with the handshake (including auth).
3. Middleware verifies JWT and sets socket.userId; then next(). Server runs `io.on('connection', (socket) => { ... })`.
4. `socket.join(socket.userId)` adds this socket to the room whose name is the user’s id. So “room = userId” and one user can have multiple sockets (e.g. multiple tabs) in the same room.

## How events work

- **Emit from client:** `socket.emit('send_message', payload)`. Server receives it in `socket.on('send_message', handler)`.
- **Emit from server to one user:** `io.to(userId).emit('receive_message', message)`. Only sockets in the room userId receive it.
- **Emit to sender only:** `socket.emit('receive_message', message)`.
- **Broadcast to others:** `socket.broadcast.emit('user_online', { userId })` – all other connected sockets.

## How the server knows which user to send to

- Each socket is in a room named by socket.userId (set in middleware). So `io.to(recipientId).emit(...)` targets that user. recipientId is computed from the chat (the participant who is not the sender).

## Online/offline

- On **connection:** server runs `socket.broadcast.emit('user_online', { userId: socket.userId })`. All other clients get it and can set that user as online (e.g. in Chat.jsx, setUsers/setChats/setSelectedChat to mark isOnline true for that userId).
- On **disconnect:** server runs `socket.broadcast.emit('user_offline', { userId })`. Others mark that user offline. No DB update; presence is purely from connection state.

---

# PART 9: BUTTON CLICK FLOWS

## Send button

- **Frontend:** MessageInput sendMessage() → clear text, set sending → socket.emit('send_message', { chatId, content }) (or POST /api/messages).
- **Backend:** Socket handler validates chat, INSERT message, io.to(recipientId).emit('receive_message', message), socket.emit('receive_message', message). (Or createMessage does INSERT and req.io.to(recipientId).emit.)
- **Receiver:** Socket receives receive_message → onNewMessage → setMessages / setChats → re-render → message appears.

## Login button

- **Frontend:** Login handleSubmit → POST /api/auth/login with { email, password }.
- **Backend:** login controller SELECT user, bcrypt.compare, JWT sign, res.json({ ...user, token }).
- **Frontend:** login(data), navigate('/'). No DB read on frontend; token is stored and used for later requests.

## Open chat

- **Frontend:** User clicks a chat in Sidebar → onSelectChat(chat) in Chat.jsx → setSelectedChat(chat).
- **Effect in Chat.jsx:** When selectedChat.id changes, GET /api/chats/:id/messages with limit 50 → setMessages(res.data.messages), setNextCursor(res.data.nextCursor).
- **Backend:** getChatMessages runs protect, then SELECT messages for that chat_id (with permission check), returns { messages, nextCursor, hasMore }.
- **Frontend:** ChatWindow and MessageInput render with the new selectedChat and messages.

## Load messages (Load older)

- **Frontend:** User clicks “Load older messages” → onLoadOlder() → GET /api/chats/:id/messages?cursor=nextCursor&limit=50.
- **Backend:** getChatMessages uses cursor (message id) to fetch older messages (e.g. WHERE id < cursor ORDER BY created_at DESC LIMIT 50); returns same shape.
- **Frontend:** Appends older messages to the beginning of messages list and updates nextCursor.

---

# PART 10: FULL END-TO-END LIFECYCLE

1. **Start backend:** `npm run dev` in backend → server.js loads, Express and Socket.io attach to httpServer, routes and socket handlers registered, listen(8000), DB ping → “Server running”, “Database connected”.
2. **Start frontend:** `npm run dev` in frontend → Vite serves on 3080, browser loads index.html and main.jsx.
3. **Open browser:** User goes to http://localhost:3080. main.jsx runs, App mounts, AuthProvider runs; if token in localStorage, GET /api/auth/me (direct to http://localhost:8000); if valid, user is set; otherwise loading false, no user.
4. **Not logged in:** PrivateRoute sees no user → Navigate to /login. Login page renders.
5. **Log in:** User submits → POST http://localhost:8000/api/auth/login → backend validates, returns token → login(data), navigate('/') → PrivateRoute renders Chat inside SocketProvider.
6. **Socket connect:** SocketContext has user.token → io('http://localhost:8000', { auth: { token } }) → server middleware verifies, connection established, socket.join(userId), broadcast user_online.
7. **Chat list:** Chat.jsx useEffect runs GET /api/chats and GET /api/auth/users (with Bearer token) → state chats and users populated → Sidebar shows chats and allows “new chat”.
8. **Select chat:** User clicks chat → setSelectedChat → useEffect runs GET /api/chats/:id/messages → messages and nextCursor set → ChatWindow shows messages, MessageInput shows for that chatId.
9. **Send message:** User types and clicks Send → socket.emit('send_message', { chatId, content }) → server INSERT and io.to(recipient).emit + socket.emit → sender and receiver both get receive_message → onNewMessage updates state → message appears in both UIs.
10. **Persistence:** Message is already in PostgreSQL; on refresh, GET /api/chats/:id/messages loads it again. So: send → save → display; later load → same message from DB.

---

# PART 11: FILE-BY-FILE EXPLANATION

## Backend

| File | Purpose | When it runs |
|------|--------|---------------|
| server.js | Entry; creates HTTP server, Express app, Socket.io; mounts routes and socket handlers; listens on PORT | On `node server.js` or `npm run dev` |
| lib/db.js | Creates pg Pool, exports db and query; connects on first query | Imported by server and all controllers/socket; first query in listen callback |
| middleware/authMiddleware.js | protect: reads Bearer token, verifies JWT, loads user into req.user | On every request to routes that use protect |
| routes/authRoutes.js | Maps POST /register, POST /login, GET /me, GET /users to controllers | When URL matches /api/auth/* |
| routes/chatRoutes.js | Maps GET /, GET /:id/messages, GET /:id, POST / to chat/message controllers; uses protect | When URL matches /api/chats/* |
| routes/messageRoutes.js | Maps POST /, PATCH /:messageId/status; uses protect | When URL matches /api/messages/* |
| controllers/authController.js | register, login, getMe, getUsers; DB and JWT | When corresponding route is hit |
| controllers/chatController.js | getChats, getChatById, createChat; DB | When chat routes are hit |
| controllers/messageController.js | getChatMessages, createMessage, updateMessageStatus; DB and req.io emit | When message routes are hit or messages loaded |
| socket/socketHandlers.js | Socket middleware (auth) and connection handler (join, send_message, message_status_update, disconnect) | When a client connects and when events are emitted |

## Frontend

| File | Purpose | When it runs |
|------|--------|---------------|
| index.html | Root HTML; div#root and script src main.jsx | Loaded by browser first |
| src/main.jsx | Mounts React app with Router | On page load |
| src/App.jsx | AuthProvider, routes, PrivateRoute, Login vs Chat | On every render after main |
| src/context/AuthContext.jsx | user, loading, login, logout; restore from token (GET /api/auth/me) | On mount and when login/logout/restore run |
| src/context/SocketContext.jsx | Creates io() when user exists; provides socket | When Chat is rendered and user has token |
| src/pages/Login.jsx | Form and submit; POST login/register; navigate on success | When path is /login |
| src/pages/Chat.jsx | Fetches chats and users; holds messages and selectedChat; socket listeners; passes props to Sidebar, ChatWindow, MessageInput | When path is / and user exists |
| src/components/Sidebar.jsx | Renders user, chat list, new-chat user list; POST /api/chats to start chat; onSelectChat | When Chat is rendered |
| src/components/ChatWindow.jsx | Renders messages, receive_message and message_status_update listeners; delivered emit; load older | When a chat is selected |
| src/components/MessageInput.jsx | Text input and Send; emit send_message or POST /api/messages | When a chat is selected |

---

This document is the single place that describes the entire WhatsApp clone: what it is, how it starts, how frontend and backend are structured, how the DB is used, how a message goes from click to storage and to the other screen, how auth and real-time work, and what each file does and when it runs.
