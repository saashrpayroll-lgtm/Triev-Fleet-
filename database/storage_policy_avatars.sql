-- Policies for 'avatars' bucket

-- 1. Public Access (View)
DROP POLICY IF EXISTS "Public Access to Avatars" ON storage.objects;
CREATE POLICY "Public Access to Avatars"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'avatars' );

-- 2. Authenticated Upload (Insert)
DROP POLICY IF EXISTS "Authenticated Users can Upload Avatars" ON storage.objects;
CREATE POLICY "Authenticated Users can Upload Avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- 3. Authenticated Update
DROP POLICY IF EXISTS "Authenticated Users can Update Avatars" ON storage.objects;
CREATE POLICY "Authenticated Users can Update Avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' );

-- 4. Authenticated Delete
DROP POLICY IF EXISTS "Authenticated Users can Delete Avatars" ON storage.objects;
CREATE POLICY "Authenticated Users can Delete Avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' );
