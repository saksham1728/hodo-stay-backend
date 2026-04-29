-- Fix the foreign key constraint for ho_coupon_usage
-- Change property_id to reference ho_units instead of ho_buildings

-- Step 1: Delete any existing records with invalid references
DELETE FROM ho_coupon_usage 
WHERE property_id NOT IN (SELECT id FROM ho_units);

-- Step 2: Drop the existing foreign key constraint
ALTER TABLE ho_coupon_usage 
DROP CONSTRAINT IF EXISTS ho_coupon_usage_property_id_fkey;

-- Step 3: Add new foreign key constraint referencing ho_units
ALTER TABLE ho_coupon_usage 
ADD CONSTRAINT ho_coupon_usage_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES ho_units(id) ON DELETE SET NULL;

-- Step 4: Rename the column for clarity (optional but recommended)
ALTER TABLE ho_coupon_usage 
RENAME COLUMN property_id TO unit_id;

-- Step 5: Update the comment
COMMENT ON COLUMN ho_coupon_usage.unit_id IS 'Reference to the unit where coupon was used';

-- Verify the change
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname = 'ho_coupon_usage_property_id_fkey';
