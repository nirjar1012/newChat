-- Run this in your Supabase SQL Editor

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone default now();

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
