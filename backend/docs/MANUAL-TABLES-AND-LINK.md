# Create PostgreSQL Tables Manually and Link to the Project

Follow these steps to create the database and tables yourself, then connect the app to it.

---

## Step 1: Create the database

In **pgAdmin** (or any PostgreSQL client):

1. Connect to your PostgreSQL server (localhost).
2. Right‑click **Databases** → **Create** → **Database**.
3. Name: `whatsapp_clone`.
4. Click **Save**.

Or in **psql** (if available):

```sql
CREATE DATABASE whatsapp_clone;
```

---

## Step 2: Create the tables

Connect to the **whatsapp_clone** database, then run the SQL below.

### Option A: Using pgAdmin

1. In pgAdmin, expand **Databases** → **whatsapp_clone**.
2. Click **whatsapp_clone** to select it.
3. Open **Tools** → **Query Tool** (or right‑click **whatsapp_clone** → **Query Tool**).
4. Copy the entire SQL from **Step 2: SQL script** below into the query editor.
5. Click **Execute** (▶) or press F5.

### Option B: Using the project’s SQL file

1. Open `backend/prisma/manual-schema.sql` in your editor.
2. Copy its contents into pgAdmin’s Query Tool (with **whatsapp_clone** selected) and run it.

### Step 2: SQL script (copy and run)

```sql
-- Table: users
CREATE TABLE IF NOT EXISTS "users" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "email"         TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "name"          TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: chats
CREATE TABLE IF NOT EXISTS "chats" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "user1_id"   TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "user2_id"   TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user1_id", "user2_id")
);
CREATE INDEX IF NOT EXISTS "chats_user1_id_idx" ON "chats"("user1_id");
CREATE INDEX IF NOT EXISTS "chats_user2_id_idx" ON "chats"("user2_id");

-- Table: messages
CREATE TABLE IF NOT EXISTS "messages" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "chat_id"    TEXT NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "sender_id"  TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content"    TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'sent',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "messages_chat_id_created_at_idx" ON "messages"("chat_id", "created_at");
```

You should see **users**, **chats**, and **messages** under **whatsapp_clone** → **Schemas** → **public** → **Tables**.

---

## Step 3: Link the project to this database

1. Open **`backend/.env`** (create it from `.env.example` if needed).
2. Set `DATABASE_URL` to your PostgreSQL connection string, for example:

   **Local PostgreSQL:**
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/whatsapp_clone
   ```
   If your password has `@`, encode it as `%40`, e.g. `graheet%4023`.

   **Neon / other cloud:**
   ```env
   DATABASE_URL=postgresql://user:pass@host.region.xxx.tech/dbname?sslmode=require
   ```

3. Save the file.

---

## Step 4: Generate Prisma client (do not run `db push`)

From the **backend** folder in a terminal:

```bash
cd backend
npx prisma generate
```

This generates the Prisma client that matches your `schema.prisma` and uses the tables you created.

- Do **not** run `npx prisma db push` after creating tables manually; the schema is already in place.

---

## Step 5: Run the app

```bash
npm run dev
```

The app will use the **whatsapp_clone** database and the **users**, **chats**, and **messages** tables you created.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Create database `whatsapp_clone` in PostgreSQL. |
| 2 | Run the SQL above (or `prisma/manual-schema.sql`) in that database. |
| 3 | Set `DATABASE_URL` in `backend/.env`. |
| 4 | Run `npx prisma generate` in `backend`. |
| 5 | Run `npm run dev` in `backend`. |

Tables are created manually; the project is linked by **DATABASE_URL** and **prisma generate** only.
