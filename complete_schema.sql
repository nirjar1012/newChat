-- ================================
-- COMPLETE SCHEMA - User Refactoring
-- ================================
-- This schema uses clerk_id as the primary key for users
-- Includes presence management (online_status, last_seen)
-- All foreign keys reference clerk_id directly
-- ================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- DROP EXISTING TABLES (Clean Slate)
-- ================================
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ================================
-- USERS TABLE
-- ================================
-- Primary key is clerk_id (text) from Clerk authentication
-- Includes presence management fields
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
-- Links users to conversations
-- ON DELETE CASCADE: if user or conversation is deleted, membership is removed
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
-- ON DELETE CASCADE: if conversation is deleted, messages are removed
-- ON DELETE SET NULL: if sender is deleted, messages remain but sender_id is NULL
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
-- INDEXES FOR PERFORMANCE
-- ================================
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_conversation_members_conversation ON public.conversation_members(conversation_id);
CREATE INDEX idx_users_online_status ON public.users(online_status);

-- ================================
-- STORAGE BUCKET
-- ================================
-- Create storage bucket for chat files (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_files', 'chat_files', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================
-- Note: These are permissive for MVP/demo purposes
-- In production, tighten these based on authenticated user context

-- Users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users are viewable by everyone"
    ON public.users FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can be inserted by anyone"
    ON public.users FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (TRUE);  -- In production: clerk_id = auth.uid() or similar

-- Conversations table
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversations accessible to all"
    ON public.conversations FOR ALL
    USING (TRUE);

-- Conversation members table
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation members accessible to all"
    ON public.conversation_members FOR ALL
    USING (TRUE);

-- Messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages accessible to all"
    ON public.messages FOR ALL
    USING (TRUE);

-- Storage policies
CREATE POLICY "Public access to chat_files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'chat_files');

CREATE POLICY "Authenticated users can upload to chat_files"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat_files');

-- ================================
-- COMPLETION NOTICE
-- ================================
-- Run this SQL in your Supabase SQL Editor
-- Then reload the schema cache: NOTIFY pgrst, 'reload config';
