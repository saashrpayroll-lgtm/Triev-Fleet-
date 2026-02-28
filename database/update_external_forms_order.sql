-- Add display_order column to external_forms if it doesn't exist
ALTER TABLE external_forms 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Optional: Update existing rows to have distinct order based on creation time (optional, but good for starting out)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM external_forms
)
UPDATE external_forms
SET display_order = numbered.rn
FROM numbered
WHERE external_forms.id = numbered.id;
