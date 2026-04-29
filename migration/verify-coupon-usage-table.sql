-- Verify and create ho_coupon_usage table if it doesn't exist
-- Run this in Supabase SQL Editor

-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'ho_coupon_usage'
);

-- If the above returns false, run the following:

-- ============================================
-- COUPON USAGE TABLE
-- ============================================
-- Tracks coupon usage history for analytics and fraud prevention
CREATE TABLE IF NOT EXISTS ho_coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_mongo_id VARCHAR(24),
    
    -- Coupon Reference
    coupon_id UUID NOT NULL REFERENCES ho_coupons(id) ON DELETE CASCADE,
    coupon_code VARCHAR(50) NOT NULL,
    
    -- Booking Reference
    booking_id UUID NOT NULL REFERENCES ho_bookings(id) ON DELETE CASCADE,
    
    -- User Information
    user_email VARCHAR(255) NOT NULL,
    user_phone VARCHAR(20) NOT NULL,
    
    -- Pricing Details
    original_price DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    final_price DECIMAL(10, 2) NOT NULL,
    
    -- Property Details
    property_id UUID REFERENCES ho_buildings(id) ON DELETE SET NULL,
    property_name VARCHAR(255),
    city VARCHAR(100),
    
    -- Booking Details
    check_in DATE,
    check_out DATE,
    nights INTEGER,
    
    -- Metadata
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for coupon usage analytics
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON ho_coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_booking_id ON ho_coupon_usage(booking_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_email ON ho_coupon_usage(user_email);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_phone ON ho_coupon_usage(user_phone);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_property_id ON ho_coupon_usage(property_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_applied_at ON ho_coupon_usage(applied_at DESC);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_applied ON ho_coupon_usage(coupon_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_applied ON ho_coupon_usage(user_email, applied_at DESC);

-- Unique constraint to prevent duplicate usage tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usage_booking_unique ON ho_coupon_usage(booking_id);

-- Trigger for updated_at
CREATE TRIGGER update_ho_coupon_usage_updated_at BEFORE UPDATE ON ho_coupon_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE ho_coupon_usage IS 'Tracks coupon usage for analytics and fraud prevention';
COMMENT ON COLUMN ho_coupon_usage.coupon_id IS 'Reference to the coupon that was used';
COMMENT ON COLUMN ho_coupon_usage.booking_id IS 'Reference to the booking where coupon was applied';
COMMENT ON COLUMN ho_coupon_usage.user_email IS 'Email of user who used the coupon';
COMMENT ON COLUMN ho_coupon_usage.discount_amount IS 'Amount discounted by the coupon';

-- Verify table was created
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'ho_coupon_usage'
ORDER BY ordinal_position;
