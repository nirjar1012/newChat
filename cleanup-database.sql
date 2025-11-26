-- =====================================
-- COMPLETE DATABASE CLEANUP SCRIPT
-- =====================================
-- This script removes ALL tables, policies, and functions
-- WARNING: This will DELETE ALL DATA permanently!
-- =====================================

-- Drop all RLS policies first
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users viewable by all" ON public.users;
DROP POLICY IF EXISTS "Users insertable by all" ON public.users;
DROP POLICY IF EXISTS "Users updatable by all" ON public.users;
DROP POLICY IF EXISTS "Users can be inserted by anyone" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;

DROP POLICY IF EXISTS "Conversations accessible to all" ON public.conversations;
DROP POLICY IF EXISTS "Conversations viewable by members" ON public.conversations;

DROP POLICY IF EXISTS "Members accessible to all" ON public.conversation_members;
DROP POLICY IF EXISTS "Conversation members accessible to all" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can view their conversations" ON public.conversation_members;

DROP POLICY IF EXISTS "Messages accessible to all" ON public.messages;
DROP POLICY IF EXISTS "Messages viewable by conversation members" ON public.messages;

DROP POLICY IF EXISTS "Friends accessible to all" ON public.friends;
DROP POLICY IF EXISTS "Friends viewable by involved users" ON public.friends;

DROP POLICY IF EXISTS "Friend requests accessible to all" ON public.friend_requests;
DROP POLICY IF EXISTS "Friend requests viewable by sender or receiver" ON public.friend_requests;

-- Drop storage policies
DROP POLICY IF EXISTS "Public access to chat_files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to chat_files" ON storage.objects;

-- Drop functions
DROP FUNCTION IF EXISTS public.is_member_of(UUID);

-- Drop tables (CASCADE removes foreign key dependencies)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;
DROP TABLE IF EXISTS public.friends CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Delete storage bucket (optional - comment out if you want to keep uploaded files)
-- DELETE FROM storage.buckets WHERE id = 'chat_files';

-- =====================================
-- CLEANUP COMPLETE
-- =====================================
-- Your database is now completely clean
-- You can now run your schema creation script
-- =====================================
