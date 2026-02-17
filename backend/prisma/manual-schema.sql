-- Run this ONLY if you are not using "prisma db push" (Option A is recommended).
-- 1. Create the database first: CREATE DATABASE whatsapp_clone;
-- 2. Connect to whatsapp_clone and run this file.

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
  "status"    TEXT NOT NULL DEFAULT 'sent',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "messages_chat_id_created_at_idx" ON "messages"("chat_id", "created_at");
