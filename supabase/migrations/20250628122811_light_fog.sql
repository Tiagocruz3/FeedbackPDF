/*
  # Create Storage Bucket for Survey PDFs

  1. Storage Setup
    - Create 'survey-pdfs' bucket for PDF file storage
    - Configure bucket to be private (not publicly accessible)
    - Set up proper file size and type restrictions

  2. Security Policies
    - Allow authenticated users to upload files to their own folder
    - Allow authenticated users to read their own uploaded files
    - Allow authenticated users to delete their own files
    - Prevent access to other users' files

  3. Configuration
    - Maximum file size: 50MB
    - Allowed file types: PDF only
    - User-specific folder structure: {user_id}/{filename}
*/

-- Create the storage bucket for survey PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'survey-pdfs',
  'survey-pdfs', 
  false,
  52428800, -- 50MB in bytes
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload PDFs to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'survey-pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND RIGHT(name, 4) = '.pdf'
);

-- Policy: Allow authenticated users to read their own uploaded files
CREATE POLICY "Users can read own PDF files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'survey-pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own PDF files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'survey-pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own files (for metadata updates)
CREATE POLICY "Users can update own PDF files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'survey-pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'survey-pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);