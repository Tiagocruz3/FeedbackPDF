/*
  # Survey Response System Schema

  1. New Tables
    - `course_uploads`
      - `id` (uuid, primary key)
      - `course_name` (text)
      - `upload_date` (timestamp)
      - `file_url` (text)
      - `file_name` (text)
      - `file_size` (bigint)
      - `processing_status` (text) - 'pending', 'processing', 'completed', 'failed'
      - `total_forms` (integer)
      - `processed_forms` (integer)
      - `created_by` (uuid, references auth.users)

    - `survey_responses`
      - `id` (uuid, primary key)
      - `upload_id` (uuid, references course_uploads)
      - `course_name` (text)
      - `response_date` (date)
      - Likert scale questions (q1-q9)
      - `q10_rating` (integer, 0-10 scale)
      - `q11_expectations` (text)
      - `q12_overall_rating` (text)
      - `learned_1` (text)
      - `learned_2` (text)
      - `learned_3` (text)
      - `suggestions` (text)
      - `comments` (text)
      - `interested_more` (text)
      - Contact information (optional)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create course uploads table
CREATE TABLE course_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name text NOT NULL,
  upload_date timestamptz DEFAULT now(),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint DEFAULT 0,
  processing_status text DEFAULT 'pending',
  total_forms integer DEFAULT 0,
  processed_forms integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for processing_status
ALTER TABLE course_uploads ADD CONSTRAINT check_processing_status 
CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- Create survey responses table
CREATE TABLE survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL,
  course_name text NOT NULL,
  response_date date,
  q1_rating integer,
  q2_rating integer,
  q3_rating integer,
  q4_rating integer,
  q5_rating integer,
  q6_rating integer,
  q7_rating integer,
  q8_rating integer,
  q9_rating integer,
  q10_rating integer,
  q11_expectations text,
  q12_overall_rating text,
  learned_1 text,
  learned_2 text,
  learned_3 text,
  suggestions text,
  comments text,
  interested_more text,
  participant_name text,
  company text,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraints for ratings
ALTER TABLE survey_responses ADD CONSTRAINT check_q1_rating CHECK (q1_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q2_rating CHECK (q2_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q3_rating CHECK (q3_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q4_rating CHECK (q4_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q5_rating CHECK (q5_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q6_rating CHECK (q6_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q7_rating CHECK (q7_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q8_rating CHECK (q8_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q9_rating CHECK (q9_rating BETWEEN 1 AND 5);
ALTER TABLE survey_responses ADD CONSTRAINT check_q10_rating CHECK (q10_rating BETWEEN 0 AND 10);

-- Add foreign key constraints
ALTER TABLE course_uploads ADD CONSTRAINT fk_course_uploads_created_by 
FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE survey_responses ADD CONSTRAINT fk_survey_responses_upload_id 
FOREIGN KEY (upload_id) REFERENCES course_uploads(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE course_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for course_uploads
CREATE POLICY "Users can view their own uploads" ON course_uploads
FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own uploads" ON course_uploads
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own uploads" ON course_uploads
FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own uploads" ON course_uploads
FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- Create policies for survey_responses
CREATE POLICY "Users can view responses from their uploads" ON survey_responses
FOR SELECT TO authenticated
USING (upload_id IN (SELECT id FROM course_uploads WHERE created_by = auth.uid()));

CREATE POLICY "Users can insert responses to their uploads" ON survey_responses
FOR INSERT TO authenticated
WITH CHECK (upload_id IN (SELECT id FROM course_uploads WHERE created_by = auth.uid()));

CREATE POLICY "Users can update responses from their uploads" ON survey_responses
FOR UPDATE TO authenticated
USING (upload_id IN (SELECT id FROM course_uploads WHERE created_by = auth.uid()))
WITH CHECK (upload_id IN (SELECT id FROM course_uploads WHERE created_by = auth.uid()));

CREATE POLICY "Users can delete responses from their uploads" ON survey_responses
FOR DELETE TO authenticated
USING (upload_id IN (SELECT id FROM course_uploads WHERE created_by = auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_course_uploads_created_by ON course_uploads(created_by);
CREATE INDEX idx_course_uploads_course_name ON course_uploads(course_name);
CREATE INDEX idx_survey_responses_upload_id ON survey_responses(upload_id);
CREATE INDEX idx_survey_responses_course_name ON survey_responses(course_name);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_course_uploads_updated_at
BEFORE UPDATE ON course_uploads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_survey_responses_updated_at
BEFORE UPDATE ON survey_responses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();