-- ============================================
-- CLERK TO SUPABASE AUTH MIGRATION
-- ============================================
-- WARNING: This will delete all existing data!
-- Run this in your Supabase SQL Editor
-- ============================================

-- Step 1: Drop existing constraints
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE conversation_members DROP CONSTRAINT IF EXISTS conversation_members_user_id_fkey;
ALTER TABLE friends DROP CONSTRAINT IF EXISTS friends_user1_id_fkey;
ALTER TABLE friends DROP CONSTRAINT IF EXISTS friends_user2_id_fkey;
ALTER TABLE friend_requests DROP CONSTRAINT IF EXISTS friend_requests_sender_id_fkey;
ALTER TABLE friend_requests DROP CONSTRAINT IF EXISTS friend_requests_receiver_id_fkey;

-- Step 2: Clear existing data (DEVELOPMENT ONLY!)
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE conversation_members CASCADE;
TRUNCATE TABLE conversations CASCADE;
TRUNCATE TABLE friend_requests CASCADE;
TRUNCATE TABLE friends CASCADE;
TRUNCATE TABLE users CASCADE;

-- Step 3: Recreate users table with proper structure
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT UNIQUE,
  profile_image TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Update all foreign keys to UUID
ALTER TABLE messages 
  ALTER COLUMN sender_id TYPE UUID USING sender_id::UUID;

ALTER TABLE conversation_members 
  ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

ALTER TABLE friends 
  ALTER COLUMN user1_id TYPE UUID USING user1_id::UUID,
  ALTER COLUMN user2_id TYPE UUID USING user2_id::UUID;

ALTER TABLE friend_requests 
  ALTER COLUMN sender_id TYPE UUID USING sender_id::UUID,
  ALTER COLUMN receiver_id TYPE UUID USING receiver_id::UUID;

-- Step 5: Re-add foreign key constraints
ALTER TABLE messages 
  ADD CONSTRAINT messages_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE conversation_members 
  ADD CONSTRAINT conversation_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE friends 
  ADD CONSTRAINT friends_user1_id_fkey 
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT friends_user2_id_fkey 
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE friend_requests 
  ADD CONSTRAINT friend_requests_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT friend_requests_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 6: Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS Policies

-- Users policies
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Messages policies
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid());

-- Conversation members policies
CREATE POLICY "Users can view their conversation memberships"
  ON conversation_members FOR SELECT
  USING (
    user_id = auth.uid() OR 
    conversation_id IN (
      SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join conversations"
  ON conversation_members FOR INSERT
  WITH CHECK (true);

-- Conversations policies  
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  USING (
    id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE
  USING (
    id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid())
  );

-- Friends policies
CREATE POLICY "Users can view their friendships"
  ON friends FOR SELECT
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Users can create friendships"
  ON friends FOR INSERT
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Users can delete their friendships"
  ON friends FOR DELETE
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Friend requests policies
CREATE POLICY "Users can view their friend requests"
  ON friend_requests FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update received requests"
  ON friend_requests FOR UPDATE
  USING (receiver_id = auth.uid());

CREATE POLICY "Users can delete their requests"
  ON friend_requests FOR DELETE
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Verify tables and policies are created
-- 3. Continue with code migration
-- ============================================
