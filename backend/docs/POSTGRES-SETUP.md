# Connecting PostgreSQL to the Backend

The app uses **Prisma** with PostgreSQL. You only need a valid `DATABASE_URL` in `.env`.

---

## Option A: Local PostgreSQL

### 1. Install PostgreSQL

- **Windows:** [Download](https://www.postgresql.org/download/windows/) and run the installer. Remember the password you set for the `postgres` user.
- **macOS:** `brew install postgresql@16` then `brew services start postgresql@16`
- **Linux:** `sudo apt install postgresql postgresql-contrib` (Ubuntu/Debian)

### 2. Create the database

Using **psql** (or pgAdmin / any client):

```bash
# Open psql (Windows: from Start menu or bin folder)
psql -U postgres
```

Then in psql:

```sql
CREATE DATABASE whatsapp_clone;
\q
```

### 3. Set `.env` in the backend folder

Copy the example and edit:

```bash
cd backend
copy .env.example .env
```

Edit `backend/.env` and set:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/whatsapp_clone
```

Replace:
- `postgres` with your PostgreSQL username if different
- `YOUR_PASSWORD` with your PostgreSQL password
- `5432` if your Postgres uses another port
- `whatsapp_clone` with your database name if you used another one

### 4. Create tables with Prisma

```bash
cd backend
npx prisma db push
```

This creates/updates all tables (users, chats, messages) in your database.

### 5. Start the server

```bash
npm run dev
```

---

## Option B: Free cloud PostgreSQL (Neon / Supabase)

No local install needed.

### Neon (recommended)

1. Go to [neon.tech](https://neon.tech) and sign up.
2. Create a new project and copy the **connection string** (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. In `backend/.env`:

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

4. Run:

```bash
cd backend
npx prisma db push
npm run dev
```

### Supabase

1. Go to [supabase.com](https://supabase.com), create a project.
2. In **Project Settings → Database** copy the **URI** (use “Transaction” or “Session” mode).
3. Put it in `backend/.env` as `DATABASE_URL`.
4. Run `npx prisma db push` and `npm run dev` as above.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Connection refused` | PostgreSQL not running. Start the service (e.g. `brew services start postgresql` or Windows Services). |
| `password authentication failed` | Wrong user/password in `DATABASE_URL`. |
| `database "whatsapp_clone" does not exist` | Create it: `CREATE DATABASE whatsapp_clone;` in psql. |
| SSL error (cloud) | Add `?sslmode=require` at the end of `DATABASE_URL` (Neon/Supabase often need this). |

---

## Verify connection

```bash
cd backend
npx prisma db pull
```

If it runs without errors, Prisma is connected. You can then run `npx prisma db push` again to sync the schema.
