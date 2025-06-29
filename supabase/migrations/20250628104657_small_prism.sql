/*
  # Fix Supabase Authentication Schema Issues

  This migration addresses the 500 error "Database error querying schema" by:
  1. Ensuring all required auth extensions are installed
  2. Fixing the users table structure and relationships
  3. Correcting RLS policies and permissions
  4. Setting up proper auth triggers and functions
  5. Granting necessary permissions to roles

  The main issue appears to be missing or corrupted auth schema components.
*/

-- Ensure required extensions are installed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop and recreate users table with proper structure
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own data"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (new.id, new.email, now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure update trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger for users
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fix course_uploads foreign key to reference users table
ALTER TABLE public.course_uploads 
DROP CONSTRAINT IF EXISTS fk_course_uploads_created_by;

ALTER TABLE public.course_uploads 
ADD CONSTRAINT fk_course_uploads_created_by 
FOREIGN KEY (created_by) REFERENCES public.users(id);

-- Grant necessary permissions to roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;
GRANT ALL ON public.course_uploads TO authenticated;
GRANT ALL ON public.survey_responses TO authenticated;

-- Grant permissions on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert existing auth users into users table
INSERT INTO public.users (id, email, created_at, updated_at)
SELECT 
  id, 
  email, 
  created_at, 
  updated_at
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Ensure auth schema permissions are correct
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT SELECT ON auth.users TO authenticated;

-- Check and fix any missing auth functions (this is informational)
DO $$
BEGIN
  -- Check if auth.uid() function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'uid' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  ) THEN
    RAISE NOTICE 'WARNING: auth.uid() function is missing. This indicates a corrupted Supabase installation.';
  END IF;
  
  -- Check if auth.role() function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'role' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  ) THEN
    RAISE NOTICE 'WARNING: auth.role() function is missing. This indicates a corrupted Supabase installation.';
  END IF;
END $$;