# Message Flow & System Deep Dive — Exact Answers from the Codebase

This document answers the exact questions about the WhatsApp clone: message flow, offline behavior, state, auth, WebSocket user mapping, ordering, reconnect, scale, group chat, security, and bonus self-test. Every answer is traced to the actual code.

---

## 1. When a user sends a message — exact flow (button click → message on receiver screen)

### Which frontend function runs?

1. **Button click** → `MessageInput.jsx`: the Send button’s `onClick={sendMessage}` calls **`sendMessage()`** (lines 17–37).
2. **Inside `sendMessage()`:**
   - `const trimmed = text.trim();` then guard: `if (!trimmed || !chatId) return;`
   - `setText('')` — clears input immediately.
   - `setSending(true)` — disables button.
   - `const payload = { chatId, content: trimmed };`
   - **If `socket` exists:** `socket.emit('send_message', payload);` then `setSending(false)` and **return**. No HTTP call.
   - **If no socket:** `axios.post(\`${API}/api/messages\`, payload, { headers: getAuthHeader() })` then `.then((res) => onMessageSent(res.data))`, `.finally(() => setSending(false))`.

So the **only** frontend function that runs for “send” is **`sendMessage()`** in `MessageInput.jsx`. When socket is connected, **no REST API is called** for sending.

### Which API (if any) is called?

- **When socket is connected:** No API is called. The client only does `socket.emit('send_message', payload)`.
- **When socket is missing (e.g. not yet connected or fallback):** `POST /api/messages` with body `{ chatId, content }` and `Authorization: Bearer <token>`.

### When is WebSocket used?

- WebSocket (Socket.io) is used **when the Send path goes through the socket**: i.e. when `socket` from `useSocket()` is truthy. Then the entire send path is: `sendMessage()` → `socket.emit('send_message', payload)` → server handles it in Socket handler and emits to recipient/sender.
- REST is used only when there is no socket (fallback) or for **loading** messages: `GET /api/chats/:id/messages` when the user selects a chat or loads older messages.

### When is DB written?

- **Socket path:** In `socketHandlers.js`, inside the `send_message` handler:
  1. Validate chat (SELECT chats).
  2. **`INSERT INTO messages (id, chat_id, sender_id, content, status, created_at) VALUES (...)`** — this is the only DB write for the message (lines 46–48). It runs **before** any emit.
  3. Then: `io.to(recipientId).emit('receive_message', message)` and `socket.emit('receive_message', message)`.
- **REST path:** In `messageController.js` `createMessage`: same **INSERT** (lines 81–84), then `req.io.to(recipientId).emit('receive_message', message)` if `req.io` exists, then `res.status(201).json(message)`.

So in both paths the message is **always written to the DB first**, then the server emits to the receiver (and back to the sender on the socket path).

### Who emits to whom?

- **Server → receiver:** `io.to(recipientId).emit('receive_message', message)`. Only sockets in the room named `recipientId` (the receiver’s user id) receive it.
- **Server → sender (socket path only):** `socket.emit('receive_message', message)`. Only the sender’s socket gets this (so the sender’s UI can show the message and status without a separate API call).

REST path: server still emits to receiver via `req.io.to(recipientId).emit(...)`; sender gets the message only in the HTTP response body (and the frontend calls `onMessageSent(res.data)` which is `onNewMessage`, so the sender’s UI is updated from the response).

### How is UI updated?

- **Sender (socket path):** Server does `socket.emit('receive_message', message)`. The sender’s app has `socket.on('receive_message', onNewMessage)` in `Chat.jsx` (effect around lines 96–106). `onNewMessage` runs; if `message.chatId === selectedChat?.id`, it appends the message with `setMessages((prev) => [...prev, message])` (with duplicate check by `m.id`), and updates `chats` lastMessage. React re-renders; `ChatWindow` gets new `messages` and shows the new bubble.
- **Receiver:** Server does `io.to(recipientId).emit('receive_message', message)`. Receiver’s socket gets the same event; same `onNewMessage` in `Chat.jsx` runs; same state update and re-render. Additionally, `ChatWindow.jsx` has a listener on `receive_message` that, if the message is from the other user and status is `'sent'`, calls `socket.emit('message_status_update', { messageId, status: 'delivered' })` so the sender can see “delivered.”

**Summary:** One frontend function (`sendMessage`); when socket exists, no API for send; WebSocket used for send/receive; DB is written before any emit; server emits to recipient room and to sender socket; both UIs update via `receive_message` → `onNewMessage` → `setMessages` / `setChats` → re-render.

---

## 2. What happens if the receiver is offline?

### Does the message get lost?

**No.** The message is **always** inserted into the database **before** any emit. So even if the receiver has no socket (offline), the row is already in `messages`. The emit `io.to(recipientId).emit('receive_message', message)` simply reaches no one when the receiver is offline; the message is not lost.

### Is it stored before emit?

**Yes.** In both the socket handler and the REST controller, the flow is: validate chat → **INSERT message** → then emit (and in socket path, emit to sender too). So storage is before emit.

### How does it get delivered later?

There is **no** “push on reconnect” or “deliver pending” event in this codebase. Delivery later works only through **pull**:

- When the receiver comes back online and **opens (or re-opens) that chat**, the frontend runs the effect in `Chat.jsx` that depends on `selectedChat?.id` (lines 132–151): it calls **`GET /api/chats/${selectedChat.id}/messages`** with `limit: 50`. The backend returns messages from the DB in chronological order. So any message sent while the receiver was offline is already in the DB and is included in that response. The receiver then sees it when the chat is selected.

So “delivered later” = **next time the receiver loads that chat’s messages via the REST API**. There is no server-side “pending delivery” queue or “sync since last seen” — just the existing “load messages when opening chat” behavior.

### What triggers loading missed messages?

- **Selecting a chat:** Changing `selectedChat` (e.g. clicking a chat in the sidebar) triggers the effect that fetches `GET /api/chats/:id/messages` and sets `messages` and `nextCursor`.
- **Re-opening the same chat:** If the user had another chat selected and then clicks back on the first chat, `selectedChat.id` changes again and the same fetch runs again, so the latest messages (including ones that arrived while they were on the other chat or offline) are loaded.
- **Page refresh:** On load, if the user is on the chat route, they go through Auth → SocketProvider → Chat; when `selectedChat` is set (e.g. from same session we’d need to re-select; after refresh there is no “selected chat” until they click one), the same GET runs.

So the **trigger** is always: **user selects a chat** (or re-selects it), which causes the GET messages API to run. There is no explicit “on socket reconnect, fetch missed messages” logic — recovery is “open the chat and you get the latest from DB.”

---

## 3. Where is state stored on the frontend?

### Where current user is stored

- **Owned by:** `AuthContext` (`AuthContext.jsx`).
- **Storage:** React state: `const [user, setUser] = useState(null)`. The **token** is also stored in **`localStorage`** under key `'token'` when `login(userData)` is called (`localStorage.setItem('token', userData.token)`). So: **in-memory:** `user` (object with id, name, email, etc.); **persisted:** token in `localStorage`.
- **Who can read it:** Any component that calls `useAuth()` gets `{ user, loading, login, logout }`. Used by: `App.jsx` (PrivateRoute), `Login.jsx`, `Chat.jsx`, `Sidebar`, and indirectly by `SocketContext` (which uses `user` for token).

### Where message list is stored

- **Owned by:** **`Chat.jsx`** (page component).
- **Storage:** `const [messages, setMessages] = useState([])`. Local component state, not global. Passed down as the `messages` prop to `ChatWindow`.
- **Filled by:** (1) When `selectedChat.id` changes: GET `/api/chats/:id/messages` then `setMessages(res.data.messages)`. (2) When `receive_message` fires: `onNewMessage` appends to `messages` (if for current chat) and updates `chats` lastMessage.

### Where selected chat is stored

- **Owned by:** **`Chat.jsx`**.
- **Storage:** `const [selectedChat, setSelectedChat] = useState(null)`. Local state. Passed to Sidebar as `selectedChat` and `onSelectChat={setSelectedChat}`; when user clicks a chat, Sidebar calls `setSelectedChat(chat)`.

### What causes re-render?

- **Auth:** When `setUser` runs in AuthContext (login, logout, or restore from token), every consumer of `useAuth()` re-renders.
- **Chat page:** When `setChats`, `setUsers`, `setSelectedChat`, `setMessages`, `setNextCursor`, or any loading setter runs, `Chat` re-renders and passes new props to Sidebar, ChatWindow, MessageInput — so those re-render.
- **Socket events:** `receive_message` and `message_status_update` call `onNewMessage` / `onStatusUpdate`, which call `setMessages` / `setChats` — so React re-renders. Same for `user_online` / `user_offline` updating `users` / `chats` / `selectedChat`.

### Which component owns the state? Global or local? Why?

- **Current user (and token):** **Global** in `AuthProvider`. Needed for: route protection, showing who is logged in, attaching token to API and socket. One place so login/logout and token are consistent.
- **Message list and selected chat:** **Local** in `Chat.jsx`. They are only needed on the chat screen and by its children (Sidebar, ChatWindow, MessageInput). No other route needs them; keeping them in Chat avoids prop drilling and keeps “chat UI state” in one place. When the user leaves the chat route (e.g. logs out), that state is discarded, which is correct.

---

## 4. How does authentication actually work?

### How is password stored?

- **Never stored in plain text.** On **register** (`authController.js`): `const passwordHash = await bcrypt.hash(password, 12);` then INSERT into `users` with `password_hash = passwordHash`. So only the bcrypt hash is stored (rounds 12).
- On **login:** `bcrypt.compare(password, user.password_hash)` — plain password is only in memory during the request.

### How is token generated?

- **Backend** (`authController.js`): `const generateToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });`. After successful login or register, `generateToken(user.id)` is called. The JWT payload is `{ id: user.id }`; signing key is `JWT_SECRET` (env or default); expiration 30 days. Token is a string (e.g. `eyJhbG...`).

### Where is token stored in the browser?

- **localStorage:** `localStorage.setItem('token', userData.token)` in `AuthContext` when `login(userData)` is called (after successful login/register response). Read with `localStorage.getItem('token')` for API headers and for Socket auth. So token is in **localStorage**, not only in memory (so it survives refresh and new tabs).

### How is token validated on every request?

- **REST:** `authMiddleware.js` — `protect` runs on every protected route. It reads `req.headers.authorization`, expects `Bearer <token>`, then `jwt.verify(token, JWT_SECRET)`. If valid, it gets `decoded.id`, loads user from DB with `db.query('SELECT ... FROM users WHERE id = $1', [decoded.id])`, sets `req.user = user` and calls `next()`. If missing or invalid token or user not found, it returns 401. So **every** protected API request validates the JWT and loads the user.
- **Socket:** In `socketHandlers.js`, `io.use((socket, next) => { ... })` runs on **every** new Socket connection. It reads `socket.handshake.auth.token`, uses the same `getUserIdFromToken(token)` (which does `jwt.verify`), sets `socket.userId = userId`. If verification fails, `next(new Error('Authentication error'))` and the connection is rejected. So the mapping “this socket = this user” is established at connection time and not re-validated on each event (events are trusted because only authenticated sockets are accepted).

### What happens when token expires?

- **JWT:** After 30 days, `jwt.verify` will throw (e.g. “jwt expired”). 
  - **REST:** `protect` catches and returns `401` “Not authorized. Invalid token.” The frontend does not currently intercept 401 globally; typical behavior would be: next API call fails with 401, and if the app calls something like GET /api/auth/me on load, the catch in AuthContext does `localStorage.removeItem('token')` and does not set user, so the UI shows logged-out and redirects to login.
  - **Socket:** If the client reconnects with an expired token, the Socket middleware will call `next(new Error('Authentication error'))` and the connection will be rejected. So expired token = no API access and no socket connection until the user logs in again and gets a new token.

---

## 5. How does the WebSocket server know which socket belongs to which user?

### When mapping happens

- **At connection time.** When the client calls `io(SOCKET_URL, { auth: { token: user.token } })`, the server runs the Socket.io **middleware** `io.use((socket, next) => { ... })`. There, the token is verified and `socket.userId = userId` is set. Then in `io.on('connection', (socket) => { ... })`, the server runs `socket.join(socket.userId)`. So the mapping is: **this socket instance → userId**, and **this socket is in the room named `userId`**.

### What data structure is used

- **Socket.io’s internal adapter.** The server does not keep an explicit `Map(userId -> sockets)` in app code. It uses **rooms**: `socket.join(socket.userId)` puts this socket into the room whose name is the string `userId`. Socket.io’s default in-memory adapter keeps something like: room name → set of socket ids. So “which sockets belong to user X” = “sockets in room `X`”. Sending to a user is `io.to(userId).emit(...)`, which sends to all sockets in that room.

### Where mapping is stored

- In **Socket.io’s in-memory state** (default adapter): room membership and socket ids. Not in our DB; not in a custom Map in server.js. So it’s in the Node process memory.

### What happens on disconnect

- `socket.on('disconnect', () => { socket.broadcast.emit('user_offline', { userId: socket.userId }); });` — we broadcast “this user went offline.” Socket.io automatically removes the socket from all rooms when it disconnects, so the room for that userId no longer contains that socket. If the user had only one tab, the room for that userId becomes empty. We don’t delete anything manually; Socket.io handles room cleanup.

### What happens if the user logs in from two tabs?

- **Two sockets** for the same user. Each connection runs the middleware and gets the same `socket.userId`; each does `socket.join(socket.userId)`. So **both sockets end up in the same room** (the room named by userId). When we do `io.to(recipientId).emit('receive_message', message)`, **both** of the receiver’s tabs receive the event. So the user sees the message in both tabs. Same for `user_online` / `user_offline` — both tabs get the same events. That’s correct for presence and messaging. No extra logic is needed for “two tabs” because the abstraction is “room = user,” not “room = socket.”

---

## 6. How are messages ordered correctly?

### Is sorting done in DB or frontend?

- **DB.** In `messageController.js` `getChatMessages`, the query is: `ORDER BY m.created_at DESC` (with optional `AND m.id < $2` for cursor). So the database returns messages in **newest-first** order. The controller then does `list.reverse()` (line 55) so the response has messages in **oldest-first** (chronological) order. The frontend does **not** re-sort; it displays `messages` in the order received from the API and appends new ones from the socket in the order they arrive.

### Is it sorted by timestamp?

- Yes. The only ordering column used is **`m.created_at`** (set by the server at INSERT time with `NOW()`). So ordering is by **server timestamp** (one timezone: the DB/server).

### What if two messages have the same timestamp?

- The query is `ORDER BY m.created_at DESC` only. PostgreSQL does not guarantee a stable order when `created_at` is equal; so two messages in the same second could appear in either order. The code does **not** add a tie-breaker (e.g. `ORDER BY m.created_at DESC, m.id DESC`). So there is a small risk of non-deterministic order when timestamps collide. For production you’d typically add `id` or a sequence to the ORDER BY.

### What about time zones?

- **Server/DB:** `created_at` is set with `NOW()` — so it’s the server’s time (and DB type is usually TIMESTAMP WITH/WITHOUT TIME ZONE depending on schema). The frontend displays with `new Date(date).toLocaleTimeString(...)` in `ChatWindow.jsx`, which uses the **client’s** local timezone. So: storage is server time; display is local time. No explicit timezone conversion in the code; if the server is UTC and the client is in another zone, the displayed time is still “that moment in your local time” because JavaScript Date parses the value and toLocaleTimeString uses local zone. So it’s consistent for users but the code doesn’t explicitly document or enforce a timezone policy.

---

## 7. What happens during reconnect? (WiFi off → message sent from other user → WiFi on)

### How does the app recover?

- **Socket.io client** has **automatic reconnection** by default. When the network comes back, the client will try to reconnect and send the same `auth: { token }` again. The server will run the middleware again and, if the token is valid, accept the connection and run `socket.join(socket.userId)` and `socket.broadcast.emit('user_online', ...)` again. So the user is “online” again and will receive **new** events (e.g. new messages) after reconnect.
- **Missed messages** are **not** pushed by the server on reconnect. This codebase has **no** “sync since last disconnect” or “replay missed events.” So the user will **not** automatically see the message that was sent while they were offline **until** they trigger a message load:
  - By **selecting the chat** (or re-selecting it), which runs `GET /api/chats/:id/messages` and replaces `messages` with the latest from DB (including the one sent while offline), or
  - By **refreshing** the page and then selecting the chat (same GET).

So recovery is: **reconnect → get new real-time events from now on; get missed messages by opening the chat (REST fetch).**

### How does it avoid duplicates?

- **When loading messages:** The GET returns a full page of messages (e.g. 50) and the effect does `setMessages(res.data.messages)` — it **replaces** the list for that chat, not append. So there’s no “append same message twice” from the load.
- **When receiving via socket:** In `onNewMessage`, we do `if (prev.some((m) => m.id === message.id)) return prev;` before appending. So if the same message is delivered twice (e.g. once via socket and once later in a load), we don’t duplicate it in the list. So duplicates are avoided by **id deduplication** in state and by **replace** on full load.

### How does it avoid missing messages?

- **For the time the user was offline:** We don’t avoid “missing” in the sense of real-time push — that message was not delivered over the socket. We “fix” it by **pull**: when the user opens the chat, we fetch from the API and get all messages in the DB for that chat (paginated). So no special “reconnect sync” is needed; the existing “load messages when selecting chat” is the mechanism. If the app **didn’t** refetch when the user re-selects the chat or didn’t have GET messages at all, then yes, they could miss messages. In the current design, they don’t miss messages as long as they open the chat (or refresh and open it).

**If there is no logic:** The only “reconnect” logic is Socket.io’s built-in reconnect. There is no custom “on reconnect, fetch messages for open chat” or “since timestamp” sync. So the app relies on (1) DB as source of truth, (2) id-based dedup, (3) replace-on-load and (4) user opening the chat to see missed messages. It’s not fragile for correctness (no duplicates, no permanent loss), but UX could be improved by e.g. refetching the current chat’s messages when the socket reconnects so the user doesn’t have to switch away and back.

---

## 8. How would the system break at 10,000 concurrent users?

### Memory usage for socket mappings

- Each socket is in a room (userId). Socket.io’s default adapter keeps socket ids and room membership in memory. 10k users with one socket each = 10k sockets and 10k rooms (each with one socket). Memory grows with connections (and with message buffers if we kept history). On a single Node process, tens of thousands of connections are possible but memory (and CPU for broadcast) becomes a concern; 10k is often at the edge of “one box” without tuning. So: **single process would see high memory** and possible OOM or slowdown under load.

### Single Node server limits

- One process, one TCP port. No horizontal scaling of the Socket.io server in this repo. So **all** connections hit the same Node process. Limits: event loop blocking (e.g. DB or CPU in handlers), max file descriptors (sockets), and memory. So at 10k users we’d hit **single-server limits** (CPU, memory, fd) unless we scale out. Scaling out would require a **sticky session or a shared adapter** (e.g. Redis adapter) so that `io.to(userId)` still reaches the right process; currently there is no shared adapter, so multi-instance would break “emit to user” unless we add one.

### Database write contention

- Every sent message does an INSERT. At high message rate, the DB becomes a bottleneck (connection pool size, lock contention on indexes, disk). So **write contention** on `messages` (and possibly on `chats` if we create many chats) could slow down or timeout. Mitigations: connection pooling (we have a pool), indexing (chat_id, created_at), and possibly batching or queuing writes at very high scale.

### Message spikes

- Many users sending at once → many concurrent `send_message` handlers and many INSERTs and many `io.to(...).emit` calls. The event loop and DB could saturate; clients could see latency or disconnects. So **spikes** could cause timeouts, slow responses, or Socket.io backpressure. No rate limiting or queue in the current code.

**Summary:** At 10k concurrent users we’d expect: **high memory and single-process bottleneck**, **no horizontal scaling** without a shared Socket.io adapter, **DB write contention** under high message rate, and **no protection against message spikes**. Saying “it will still work” would be wrong; we’d need scaling, adapter, and possibly rate limiting and queues.

---

## 9. How would you add group chat without breaking the current design?

### What must change?

- **DB schema:**
  - **chats:** Today it’s 1-to-1 (user1_id, user2_id). For groups we need either: a type (e.g. `type: 'direct' | 'group'`) and for groups ignore user2 or add a separate `group_chats` table with (id, name, created_by, created_at) and a **chat_members** (chat_id, user_id, role?) so one chat can have N members. Prefer **one chats table** with `type` and a **participants/members** table (chat_id, user_id) so the same “chat” concept can be 2 or N users. Then “recipient” for 1-to-1 is “the other member”; for group it’s “all other members.”
  - **messages:** Can stay (chat_id, sender_id, content, status, created_at). Same for 1-to-1 and group; we’d just interpret “chat” as either direct or group.

- **WebSocket logic:**
  - **send_message:** Today we compute `recipientId` as the single other user. For groups we’d compute “all other members of this chat” (or all members and emit to all, and let clients filter “not me” if needed). So: `io.to(recipientId)` becomes a loop: for each member except sender, `io.to(memberId).emit('receive_message', message)`, or we add a **room per chat** (e.g. `socket.join(chatId)` when opening a chat) and then `io.to(chatId).emit('receive_message', message)` so everyone in that chat gets it. The second (room = chatId) scales better and matches “group” naturally.
  - **message_status_update:** Currently we emit to `message.senderId`. Same for groups (only sender cares about status). **user_online / user_offline:** No change; still per-user rooms.

- **API:**
  - **GET /api/chats:** Return both direct and group chats; for groups, lastMessage and “other” might be “group name” and last sender. **GET /api/chats/:id/messages:** Same; already keyed by chat_id. **POST /api/chats:** For groups we’d need something like `{ name, memberIds: [...] }` and create chat + insert into members table. **Create message:** Same REST and socket payload (chatId, content); only “who is recipient” changes on the server.

So: **schema** = add chat type and members (or group_chats + members); **Socket** = either emit to each member or use room(chatId); **API** = extend create chat and list chats for groups. The current “one chat, one other user” is a special case of “one chat, N members.”

---

## 10. Where are the biggest security risks?

- **Token in localStorage:** XSS can steal the token. Prefer httpOnly cookies for tokens if you can (and CSRF protection). So **localStorage is a known risk** for token storage.
- **No rate limiting:** Login, register, send_message, and REST endpoints are not rate-limited. **Brute force** on login and **abuse/spam** (sending huge numbers of messages or requests) are possible. So **no rate limiting** is a risk.
- **No input sanitization:** Message `content` is inserted into the DB and sent to clients. If we ever render HTML from it, **XSS** is possible. Even if we only show as text, **extremely long content** can cause issues (see next). So **no sanitization** and **no safe rendering contract** (e.g. always text escape) is a risk.
- **No message size limits:** There is no check on `content.length` in socket handler or in createMessage. Very long strings can exhaust memory, DB size, or cause performance issues. So **no message size limit** is a risk.
- **Socket auth:** We **do** authenticate the socket (middleware with JWT). So “no auth on socket” is **not** true here — unauthenticated connections are rejected. Good.
- **SQL injection:** Queries use parameterized `$1, $2` with `db.query(text, params)`. So **parameterized queries** are used; SQL injection risk is low as long as we don’t concatenate user input into SQL.
- **File upload:** There is no file upload in the codebase. So no file upload risks to comment on; if added, validation and storage would be critical.
- **JWT secret default:** `JWT_SECRET || 'whatsapp-clone-secret-change-in-production'` — if env is not set, a default is used. In production that would be **weak**; we should require JWT_SECRET in production.

**Summary:** Main risks: **localStorage for token (XSS)**, **no rate limiting**, **no input sanitization / safe rendering**, **no message size limit**, and **default JWT secret**. Saying “I think it’s secure” would be dangerous; these should be explicitly addressed.

---

## Bonus: Backend self-test (structure and pitfalls)

- **Why does each folder exist?**
  - **controllers:** Hold HTTP request handlers (auth, chats, messages); separate from routes so routes stay thin and logic is testable.
  - **routes:** Map URL + method to controller functions and middleware (e.g. protect); single place for API surface.
  - **middleware:** Reusable pipeline (auth); used by routes.
  - **socket:** Socket.io middleware and event handlers; separate from Express so connection lifecycle and events are clear.
  - **lib:** Shared infra (e.g. db pool); no business logic.

- **What would break if you removed this middleware?**
  - **Remove `protect` from chat/message routes:** Anyone could call GET/POST with no token and get 401; without protect we’d have no req.user, so controller would crash or behave as “anonymous” — **authorization would be broken.**
  - **Remove Socket `io.use` auth:** Any client could connect without a token and we wouldn’t set socket.userId; `send_message` would use undefined userId and DB/emit would break; we’d also be unable to target users. **Socket security and correctness would break.**

- **Why is this function async?**
  - Controllers and socket handlers are **async** because they **await** `db.query(...)`. If they weren’t async, we couldn’t await and would get promises instead of results; we’d have to use .then() or we’d pass unresolved promises to res.json(), etc. So async is for **awaiting DB and keeping code linear.**

- **Where could race conditions happen?**
  - **Two requests creating the same 1-to-1 chat:** Two POST /api/chats with same user pair at the same time could both see “no existing chat” and both insert, creating duplicate chats. Mitigation: unique constraint on (user1_id, user2_id) and handle conflict. 
  - **Message list:** Frontend: if two responses for GET messages (e.g. rapid chat switch) complete out of order, we might set messages for chat A with result from chat B. Mitigation: ignore stale responses (e.g. track request id or selectedChat.id when starting and when response arrives). Not currently implemented.

- **Where could memory leaks happen?**
  - **Socket listeners:** If we added listeners in a long-lived object and never removed them on disconnect, they could hold references. Currently we use `socket.on` in the connection callback; when the socket disconnects, Socket.io cleans up. So we’re okay. 
  - **Frontend:** `useEffect` for socket listeners pass cleanup (`return () => { socket.off(...) }`), so we’re good. If we ever subscribed without cleanup (e.g. in a ref that never runs cleanup), we’d leak. 
  - **DB pool:** If we never closed the pool on shutdown, the process would hold connections until exit; that’s normal for a long-running server. No leak in the sense of unbounded growth.

---

## What “real understanding” looks like

- You can **draw**: browser (React, Socket client, Axios) → one HTTP server (Express + Socket.io) → DB; with “room = userId,” “message INSERT then emit,” “token in header and handshake.”
- You can **rewrite** the core flow: “Send: click → sendMessage → emit send_message → server: verify chat, INSERT, io.to(recipient).emit + socket.emit → both clients on receive_message → setMessages → re-render.”
- **Trade-offs:** Real-time vs REST fallback; localStorage for token (simple but XSS risk); single process (simple but doesn’t scale); pull-for-missed (simple, no replay queue).
- **Design weaknesses:** (1) No refetch on socket reconnect for current chat. (2) No rate limiting or message size limit. (3) Token in localStorage (XSS). (4) Ordering by created_at only (tie-break). (5) Single server / no shared adapter for horizontal scaling.

This document is the single source for “how it really works” and “where it would break” for this codebase.
