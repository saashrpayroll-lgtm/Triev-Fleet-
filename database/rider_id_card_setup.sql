-- 1. Add photo_url column to riders table (if not already added)
ALTER TABLE riders ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create the storage bucket 'rider-photos' if it doesn't exist
-- This assumes you have permissions to insert into storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('rider-photos', 'rider-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for 'rider-photos'
-- Policy: Allow authenticated users to upload photos
CREATE POLICY "Allow TL/Admin Upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'rider-photos');

-- Policy: Allow public read access to rider photos
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'rider-photos');

-- Policy: Allow authenticated users to update/delete photos
CREATE POLICY "Allow TL/Admin Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'rider-photos');

CREATE POLICY "Allow TL/Admin Delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'rider-photos');

-- Note: If you face "permission denied" error running this script, 
-- please manually create a Public bucket named 'rider-photos' 
-- in the Supabase Dashboard -> Storage section.
