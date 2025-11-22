-- Add missing columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name text;

-- Add missing column to conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone default now();

-- Add missing columns for unread features (just in case)
ALTER TABLE public.conversation_members ADD COLUMN IF NOT EXISTS last_read_at timestamp with time zone default now();
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- Reload schema cache to fix PGRST204
NOTIFY pgrst, 'reload config';
