-- SQL queries to check Supabase Auth schema health
-- Run these in your Supabase SQL editor

-- 1. Check if auth schema exists and has required tables
SELECT 
  table_schema, 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 2. Check auth functions
SELECT 
  proname as function_name,
  pronamespace::regnamespace as schema_name
FROM pg_proc 
WHERE proname LIKE 'auth_%'
ORDER BY proname;

-- 3. Check auth extensions
SELECT 
  extname as extension_name,
  extversion as version
FROM pg_extension 
WHERE extname IN ('pgcrypto', 'uuid-ossp', 'pgjwt');

-- 4. Check auth.users table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'auth' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 5. Check for custom triggers on auth tables
SELECT 
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE event_object_schema = 'auth'
ORDER BY event_object_table, trigger_name;

-- 6. Check auth.identities table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'auth' 
  AND table_name = 'identities'
ORDER BY ordinal_position;

-- 7. Check if there are any auth users
SELECT 
  COUNT(*) as user_count,
  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed_users
FROM auth.users;

-- 8. Check RLS policies on auth tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'auth'
ORDER BY tablename, policyname;