/*
  # Fix authentication policies and schema

  1. Updates
    - Fix RLS policies to use auth.uid() instead of uid()
    - Ensure proper authentication setup
  
  2. Security
    - Update all RLS policies to use correct auth function
    - Maintain data security for authenticated users
*/

-- Drop existing policies that might be using incorrect uid() function
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Recreate policies with correct auth.uid() function
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Also fix the course_uploads policies
DROP POLICY IF EXISTS "Users can delete their own uploads" ON course_uploads;
DROP POLICY IF EXISTS "Users can insert their own uploads" ON course_uploads;
DROP POLICY IF EXISTS "Users can update their own uploads" ON course_uploads;
DROP POLICY IF EXISTS "Users can view their own uploads" ON course_uploads;

CREATE POLICY "Users can delete their own uploads"
  ON course_uploads
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own uploads"
  ON course_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own uploads"
  ON course_uploads
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view their own uploads"
  ON course_uploads
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Fix survey_responses policies
DROP POLICY IF EXISTS "Users can delete responses from their uploads" ON survey_responses;
DROP POLICY IF EXISTS "Users can insert responses to their uploads" ON survey_responses;
DROP POLICY IF EXISTS "Users can update responses from their uploads" ON survey_responses;
DROP POLICY IF EXISTS "Users can view responses from their uploads" ON survey_responses;

CREATE POLICY "Users can delete responses from their uploads"
  ON survey_responses
  FOR DELETE
  TO authenticated
  USING (upload_id IN (
    SELECT id FROM course_uploads WHERE created_by = auth.uid()
  ));

CREATE POLICY "Users can insert responses to their uploads"
  ON survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (upload_id IN (
    SELECT id FROM course_uploads WHERE created_by = auth.uid()
  ));

CREATE POLICY "Users can update responses from their uploads"
  ON survey_responses
  FOR UPDATE
  TO authenticated
  USING (upload_id IN (
    SELECT id FROM course_uploads WHERE created_by = auth.uid()
  ))
  WITH CHECK (upload_id IN (
    SELECT id FROM course_uploads WHERE created_by = auth.uid()
  ));

CREATE POLICY "Users can view responses from their uploads"
  ON survey_responses
  FOR SELECT
  TO authenticated
  USING (upload_id IN (
    SELECT id FROM course_uploads WHERE created_by = auth.uid()
  ));