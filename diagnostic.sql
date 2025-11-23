-- =========================================
-- DIAGNOSTIC: Check Current Schema Status
-- =========================================
-- Run these queries in Supabase SQL Editor to diagnose issues

-- 1. Check if users table has the new structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Expected columns:
-- clerk_id (PRIMARY KEY)
-- username
-- first_name
-- last_name
-- email
-- profile_image
-- online_status
-- last_seen
-- created_at

-- 2. Check what the PRIMARY KEY actually is
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'users' AND constraint_name LIKE '%pkey%';

-- Expected: clerk_id should be the primary key

-- 3. Check if any users exist and their online status
SELECT clerk_id, first_name, last_name, online_status, last_seen
FROM users
ORDER BY last_seen DESC
LIMIT 10;

-- 4. Check if online_status column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'online_status';

-- If this returns no rows, you NEED to run complete_schema.sql

-- =========================================
-- QUICK FIX: If schema is wrong, run:
-- =========================================
-- Copy all of complete_schema.sql and run it
-- Then run: NOTIFY pgrst, 'reload config';
