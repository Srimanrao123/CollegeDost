-- Setup storage bucket for profile images
-- This creates the bucket and sets up proper policies

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-image',
  'profile-image',
  true, -- Make bucket public for easy access
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- Storage policies for profile-image bucket
-- Allow authenticated users to upload their own profile images
CREATE POLICY "Users can upload their own profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-image' AND
  (storage.foldername(name))[1] = auth.uid()::text OR
  name LIKE auth.uid()::text || '-%'
);

-- Allow authenticated users to update their own profile images
CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-image' AND
  (storage.foldername(name))[1] = auth.uid()::text OR
  name LIKE auth.uid()::text || '-%'
)
WITH CHECK (
  bucket_id = 'profile-image' AND
  (storage.foldername(name))[1] = auth.uid()::text OR
  name LIKE auth.uid()::text || '-%'
);

-- Allow authenticated users to delete their own profile images
CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-image' AND
  (storage.foldername(name))[1] = auth.uid()::text OR
  name LIKE auth.uid()::text || '-%'
);

-- Allow public read access to profile images (since bucket is public)
CREATE POLICY "Public can view profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-image');

