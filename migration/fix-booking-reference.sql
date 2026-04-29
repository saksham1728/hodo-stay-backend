-- Fix booking_reference column size and clear existing data
-- Run this in Supabase SQL Editor

-- Delete existing bookings (30 were imported before the error)
DELETE FROM ho_bookings;

-- Increase booking_reference column size
ALTER TABLE ho_bookings 
ALTER COLUMN booking_reference TYPE VARCHAR(100);

-- Verify the change
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'ho_bookings' AND column_name = 'booking_reference';
