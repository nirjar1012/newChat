-- Run this in your Supabase SQL Editor to support Unread Badges and Read Receipts

-- 1. Add last_read_at to conversation_members to track when a user last read a chat
ALTER TABLE public.conversation_members ADD COLUMN IF NOT EXISTS last_read_at timestamp with time zone default now();

-- 2. Add read_at to messages to track when a specific message was read (for double ticks)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
