/*
  # Fix Authentication Schema Issues

  This migration addresses the authentication schema problems by:
  1. Ensuring the users table exists with proper structure
  2. Setting up correct foreign key relationships
  3. Creating proper RLS policies
  4. Setting up the auth trigger function correctly

  Changes:
  - Drop and recreate users table with correct structure
  - Fix foreign key constraints
  - Ensure proper RLS policies
  - Set up auth trigger function
*/

-- Drop existing users table and recreate it properly
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table with correct structure
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create trigger for new user creation
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

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fix course_uploads foreign key constraint
ALTER TABLE public.course_uploads 
DROP CONSTRAINT IF EXISTS fk_course_uploads_created_by;

ALTER TABLE public.course_uploads 
ADD CONSTRAINT fk_course_uploads_created_by 
FOREIGN KEY (created_by) REFERENCES public.users(id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- Insert user record for existing auth users (if any)
INSERT INTO public.users (id, email, created_at, updated_at)
SELECT 
  id, 
  email, 
  created_at, 
  updated_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;