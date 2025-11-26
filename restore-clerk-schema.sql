-- ================================
-- RESTORE CLERK SCHEMA
-- ================================
-- Run this script to revert your database to work with Clerk Auth.
-- WARNING: This will DELETE all existing data in these tables!

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- DROP EXISTING TABLES (Clean Slate)
-- ================================
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;
DROP TABLE IF EXISTS public.friends CASCADE;

-- ================================
-- USERS TABLE
-- ================================
-- Primary key is clerk_id (text) from Clerk authentication
CREATE TABLE public.users (
    clerk_id TEXT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    profile_image TEXT,
    online_status TEXT DEFAULT 'offline' CHECK (online_status IN ('online', 'offline')),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- CONVERSATIONS TABLE
-- ================================
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_group BOOLEAN DEFAULT FALSE,
    group_name TEXT,
    group_image TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- CONVERSATION_MEMBERS TABLE
-- ================================
CREATE TABLE public.conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(clerk_id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- ================================
-- MESSAGES TABLE
-- ================================
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id TEXT REFERENCES public.users(clerk_id) ON DELETE SET NULL,
    content TEXT,
    file_url TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- FRIENDS TABLE
-- ================================
CREATE TABLE public.friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id TEXT NOT NULL REFERENCES public.users(clerk_id) ON DELETE CASCADE,
    user2_id TEXT NOT NULL REFERENCES public.users(clerk_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

-- ================================
-- FRIEND REQUESTS TABLE
-- ================================
CREATE TABLE public.friend_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id TEXT NOT NULL REFERENCES public.users(clerk_id) ON DELETE CASCADE,
    receiver_email TEXT NOT NULL,
    receiver_id TEXT REFERENCES public.users(clerk_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sender_id, receiver_id)
);

-- ================================
-- INDEXES
-- ================================
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_users_online_status ON public.users(online_status);

-- ================================
-- RLS POLICIES (Permissive for now)
-- ================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users viewable by all" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users insertable by all" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users updatable by all" ON public.users FOR UPDATE USING (true);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conversations accessible to all" ON public.conversations FOR ALL USING (true);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members accessible to all" ON public.conversation_members FOR ALL USING (true);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages accessible to all" ON public.messages FOR ALL USING (true);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends accessible to all" ON public.friends FOR ALL USING (true);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friend requests accessible to all" ON public.friend_requests FOR ALL USING (true);
