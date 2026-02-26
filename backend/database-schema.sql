-- ============================================================
-- WhatsApp Clone - Complete PostgreSQL Schema
-- ============================================================
-- Run this entire file in your PostgreSQL database
-- ============================================================

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name        TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================
-- 2. CHATS TABLE
-- ============================================================
-- Supports both direct chats (user1_id, user2_id) and group chats (type='group', name)
CREATE TABLE IF NOT EXISTS chats (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL DEFAULT 'direct',
  name        TEXT,
  user1_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  user2_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);
CREATE INDEX IF NOT EXISTS idx_chats_user1_id ON chats(user1_id);
CREATE INDEX IF NOT EXISTS idx_chats_user2_id ON chats(user2_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);

-- ============================================================
-- 3. CHAT_MEMBERS TABLE
-- ============================================================
-- Tracks which users are in which chats (for both direct and group chats)
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);

-- ============================================================
-- 4. MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'sent',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- ============================================================
-- 5. BACKFILL EXISTING DIRECT CHATS INTO chat_members
-- ============================================================
-- If you already have direct chats, run this to populate chat_members
INSERT INTO chat_members (chat_id, user_id)
  SELECT id, user1_id FROM chats WHERE user1_id IS NOT NULL
  ON CONFLICT (chat_id, user_id) DO NOTHING;

INSERT INTO chat_members (chat_id, user_id)
  SELECT id, user2_id FROM chats WHERE user2_id IS NOT NULL
  ON CONFLICT (chat_id, user_id) DO NOTHING;

-- ============================================================
-- VERIFICATION QUERIES (Optional - run to verify tables)
-- ============================================================

-- Check all tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
-- ORDER BY table_name;

-- Check users table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' ORDER BY ordinal_position;

-- Check chats table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'chats' ORDER BY ordinal_position;

-- Check chat_members table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'chat_members' ORDER BY ordinal_position;

-- Check messages table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'messages' ORDER BY ordinal_position;

-- ============================================================
-- NOTES
-- ============================================================
-- 1. All IDs are TEXT (strings) because crypto.randomUUID() returns strings
-- 2. For direct chats: type='direct', user1_id and user2_id are set, name is NULL
-- 3. For group chats: type='group', name is set, user1_id and user2_id are NULL
-- 4. chat_members table tracks membership for BOTH direct and group chats
-- 5. Foreign keys use ON DELETE CASCADE to clean up related records
-- ============================================================
