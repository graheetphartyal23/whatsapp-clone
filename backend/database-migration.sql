-- ============================================================
-- WhatsApp Clone - Database Migration Script
-- ============================================================
-- Run this if you already have tables and need to add group chat support
-- ============================================================

-- ============================================================
-- Step 1: Add new columns to chats table (if not exists)
-- ============================================================
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Ensure existing rows are marked as direct
UPDATE chats SET type = 'direct' WHERE type IS NULL;

-- ============================================================
-- Step 2: Make user1_id and user2_id nullable (for group chats)
-- ============================================================
-- Note: This will only work if there are no NOT NULL constraints
-- If you get an error, you may need to drop and recreate the table
ALTER TABLE chats
  ALTER COLUMN user1_id DROP NOT NULL,
  ALTER COLUMN user2_id DROP NOT NULL;

-- ============================================================
-- Step 3: Create chat_members table (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);

-- ============================================================
-- Step 4: Backfill existing direct chats into chat_members
-- ============================================================
INSERT INTO chat_members (chat_id, user_id)
  SELECT id, user1_id FROM chats WHERE user1_id IS NOT NULL
  ON CONFLICT (chat_id, user_id) DO NOTHING;

INSERT INTO chat_members (chat_id, user_id)
  SELECT id, user2_id FROM chats WHERE user2_id IS NOT NULL
  ON CONFLICT (chat_id, user_id) DO NOTHING;

-- ============================================================
-- Step 5: Verify migration
-- ============================================================
-- Check that all existing chats have members
-- SELECT c.id, c.type, c.name, COUNT(cm.user_id) as member_count
-- FROM chats c
-- LEFT JOIN chat_members cm ON c.id = cm.chat_id
-- GROUP BY c.id, c.type, c.name;

-- ============================================================
-- ROLLBACK (if needed - run these in reverse order)
-- ============================================================
-- DROP TABLE IF EXISTS chat_members;
-- ALTER TABLE chats DROP COLUMN IF EXISTS name;
-- ALTER TABLE chats DROP COLUMN IF EXISTS type;
-- ALTER TABLE chats ALTER COLUMN user1_id SET NOT NULL;
-- ALTER TABLE chats ALTER COLUMN user2_id SET NOT NULL;
