-- Add photo_url column to riders table
ALTER TABLE riders ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Instructions for Supabase Storage:
-- 1. Create a public bucket named 'rider-photos'
-- 2. Run the following policies to allow Team Leaders/Admins to manage photos

-- Policy: Allow authenticated users to upload photos
-- CREATE POLICY "Allow TL/Admin Upload" 
-- ON storage.objects FOR INSERT 
-- TO authenticated 
-- WITH CHECK (bucket_id = 'rider-photos');

-- Policy: Allow public read access to rider photos
-- CREATE POLICY "Public Read Access" 
-- ON storage.objects FOR SELECT 
-- TO public 
-- USING (bucket_id = 'rider-photos');

-- Policy: Allow authenticated users to update/delete their own uploads (simplified for this app)
-- CREATE POLICY "Allow TL/Admin Update" 
-- ON storage.objects FOR UPDATE 
-- TO authenticated 
-- USING (bucket_id = 'rider-photos');

-- CREATE POLICY "Allow TL/Admin Delete" 
-- ON storage.objects FOR DELETE 
-- TO authenticated 
-- USING (bucket_id = 'rider-photos');
