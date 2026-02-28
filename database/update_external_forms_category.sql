-- Add category column to external_forms
ALTER TABLE external_forms 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'form' CHECK (category IN ('form', 'sheet'));

-- Update existing forms to be 'form' type explicitly
UPDATE external_forms SET category = 'form' WHERE category IS NULL;
