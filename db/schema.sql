-- PostgreSQL Schema for Hodo Stay Backend Migration
-- This schema creates tables with "ho_" prefix to avoid conflicts with existing schemas

-- ============================================================================
-- BUILDINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ho_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id VARCHAR(24),
  
  -- Core identifiers
  slug VARCHAR(255) UNIQUE,
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  sub_title VARCHAR(255),
  description TEXT,
  
  -- Location (JSONB)
  location JSONB,
  legacy_location JSONB,
  
  -- Media
  hero_image TEXT,
  gallery JSONB,
  images JSONB,
  
  -- Highlights
  highlights TEXT[],
  
  -- Amenities (JSONB array)
  amenities JSONB,
  legacy_amenities TEXT[],
  
  -- Accessibility (JSONB)
  accessibility JSONB,
  
  -- Policies (JSONB)
  policies JSONB,
  
  -- Reviews (JSONB)
  review_summary JSONB,
  reviews JSONB,
  
  -- Room types (JSONB array)
  room_types JSONB,
  
  -- SEO (JSONB)
  seo JSONB,
  
  -- Building details
  total_units INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for ho_buildings
CREATE INDEX IF NOT EXISTS idx_ho_buildings_slug ON ho_buildings(slug);
CREATE INDEX IF NOT EXISTS idx_ho_buildings_active ON ho_buildings(is_active);
CREATE INDEX IF NOT EXISTS idx_ho_buildings_city ON ho_buildings((location->>'city'));
CREATE INDEX IF NOT EXISTS idx_ho_buildings_state ON ho_buildings((location->>'state'));

-- ============================================================================
-- UNITS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ho_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id VARCHAR(24),
  
  -- Rentals United identifiers
  ru_property_id INTEGER UNIQUE NOT NULL,
  ru_owner_id INTEGER NOT NULL,
  
  -- Building reference
  building_id UUID REFERENCES ho_buildings(id) NOT NULL,
  
  -- Unit details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit_type VARCHAR(100) NOT NULL,
  unit_type_slug VARCHAR(100),
  is_representative BOOLEAN DEFAULT false,
  
  -- Specifications
  space NUMERIC,
  standard_guests INTEGER DEFAULT 1,
  can_sleep_max INTEGER DEFAULT 1,
  no_of_units INTEGER DEFAULT 1,
  floor INTEGER,
  
  -- Property type (JSONB)
  property_type JSONB,
  
  -- Pricing (JSONB)
  pricing JSONB,
  
  -- Check-in/out (JSONB)
  check_in_out JSONB,
  
  -- Images (JSONB array)
  images JSONB,
  
  -- Amenities (JSONB array)
  amenities JSONB,
  
  -- Composition rooms (JSONB array)
  composition_rooms JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  
  -- Sync info
  last_synced_at TIMESTAMP DEFAULT NOW(),
  ru_last_mod TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for ho_units
CREATE INDEX IF NOT EXISTS idx_ho_units_ru_property_id ON ho_units(ru_property_id);
CREATE INDEX IF NOT EXISTS idx_ho_units_building_id ON ho_units(building_id);
CREATE INDEX IF NOT EXISTS idx_ho_units_unit_type ON ho_units(unit_type);
CREATE INDEX IF NOT EXISTS idx_ho_units_active ON ho_units(is_active, is_archived);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ho_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id VARCHAR(24),
  
  -- Basic info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(30) NOT NULL,
  
  -- Address (JSONB)
  address JSONB,
  
  -- Preferences (JSONB)
  preferences JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  total_bookings INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for ho_users
CREATE INDEX IF NOT EXISTS idx_ho_users_email ON ho_users(email);
CREATE INDEX IF NOT EXISTS idx_ho_users_phone ON ho_users(phone);

-- ============================================================================
-- COUPONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ho_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id VARCHAR(24),
  
  -- Basic info
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Discount config
  discount_type VARCHAR(20) NOT NULL,
  discount_value NUMERIC NOT NULL,
  max_discount_amount NUMERIC,
  
  -- Usage restrictions
  usage_type VARCHAR(30) NOT NULL DEFAULT 'unlimited',
  max_total_usage INTEGER,
  max_usage_per_user INTEGER DEFAULT 1,
  current_usage_count INTEGER DEFAULT 0,
  
  -- Usage tracking (JSONB array)
  used_by JSONB DEFAULT '[]'::jsonb,
  
  -- User eligibility
  new_users_only BOOLEAN DEFAULT false,
  specific_users TEXT[],
  excluded_users TEXT[],
  
  -- Scope restrictions
  applicable_on VARCHAR(20) DEFAULT 'all',
  properties UUID[],
  cities TEXT[],
  
  -- Validity period
  valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP NOT NULL,
  
  -- Minimum requirements
  min_booking_amount NUMERIC DEFAULT 0,
  min_nights INTEGER DEFAULT 1,
  
  -- Metadata
  created_by VARCHAR(100) DEFAULT 'admin',
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for ho_coupons
CREATE INDEX IF NOT EXISTS idx_ho_coupons_code ON ho_coupons(code, is_active);
CREATE INDEX IF NOT EXISTS idx_ho_coupons_validity ON ho_coupons(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_ho_coupons_used_by ON ho_coupons USING GIN (used_by);

-- ============================================================================
-- BOOKINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ho_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id VARCHAR(24),
  
  -- References
  booking_reference VARCHAR(100) UNIQUE NOT NULL,
  ru_reservation_id VARCHAR(100),
  user_id UUID REFERENCES ho_users(id),
  building_id UUID REFERENCES ho_buildings(id) NOT NULL,
  unit_id UUID REFERENCES ho_units(id) NOT NULL,
  ru_property_id INTEGER NOT NULL,
  
  -- Dates
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER NOT NULL,
  
  -- Guest Information (JSONB)
  guest_info JSONB NOT NULL,
  
  -- Guest counts
  number_of_guests INTEGER NOT NULL,
  number_of_adults INTEGER DEFAULT 1,
  number_of_children INTEGER DEFAULT 0,
  number_of_infants INTEGER DEFAULT 0,
  
  -- Pricing (JSONB)
  pricing JSONB NOT NULL,
  
  -- Coupon
  applied_coupon VARCHAR(50),
  coupon_id UUID REFERENCES ho_coupons(id),
  
  -- Payment (JSONB)
  payment JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  ru_status VARCHAR(50),
  booking_source VARCHAR(20) DEFAULT 'direct',
  
  -- Cancellation (JSONB)
  cancellation JSONB,
  
  -- Special requests
  special_requests TEXT,
  
  -- Access token
  access_token VARCHAR(64) UNIQUE,
  token_expires_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for ho_bookings
CREATE INDEX IF NOT EXISTS idx_ho_bookings_user_id ON ho_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_ho_bookings_building_id ON ho_bookings(building_id);
CREATE INDEX IF NOT EXISTS idx_ho_bookings_unit_id ON ho_bookings(unit_id);
CREATE INDEX IF NOT EXISTS idx_ho_bookings_check_in ON ho_bookings(check_in);
CREATE INDEX IF NOT EXISTS idx_ho_bookings_check_out ON ho_bookings(check_out);
CREATE INDEX IF NOT EXISTS idx_ho_bookings_status ON ho_bookings(status);
CREATE INDEX IF NOT EXISTS idx_ho_bookings_source ON ho_bookings(booking_source);
CREATE INDEX IF NOT EXISTS idx_ho_bookings_email ON ho_bookings((guest_info->>'email'));
CREATE INDEX IF NOT EXISTS idx_ho_bookings_order_id ON ho_bookings((payment->>'orderId'));
CREATE INDEX IF NOT EXISTS idx_ho_bookings_access_token ON ho_bookings(access_token);
CREATE INDEX IF NOT EXISTS idx_ho_bookings_created_at ON ho_bookings(created_at DESC);

-- ============================================================================
-- PROPERTY_DAILY_CACHE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ho_property_daily_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  unit_id UUID REFERENCES ho_units(id) NOT NULL,
  ru_property_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  
  -- Availability
  is_available BOOLEAN NOT NULL DEFAULT false,
  
  -- Pricing
  price_per_night NUMERIC NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Metadata
  last_synced TIMESTAMP DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(unit_id, date)
);

-- Indexes for ho_property_daily_cache
CREATE INDEX IF NOT EXISTS idx_ho_cache_unit_id ON ho_property_daily_cache(unit_id);
CREATE INDEX IF NOT EXISTS idx_ho_cache_date ON ho_property_daily_cache(date);
CREATE INDEX IF NOT EXISTS idx_ho_cache_available ON ho_property_daily_cache(date, is_available);
CREATE INDEX IF NOT EXISTS idx_ho_cache_ru_property ON ho_property_daily_cache(ru_property_id);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_ho_buildings_updated_at BEFORE UPDATE ON ho_buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ho_units_updated_at BEFORE UPDATE ON ho_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ho_users_updated_at BEFORE UPDATE ON ho_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ho_coupons_updated_at BEFORE UPDATE ON ho_coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ho_bookings_updated_at BEFORE UPDATE ON ho_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ho_property_daily_cache_updated_at BEFORE UPDATE ON ho_property_daily_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CLEANUP FUNCTION FOR OLD CACHE RECORDS (180 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_cache_records()
RETURNS void AS $$
BEGIN
  DELETE FROM ho_property_daily_cache
  WHERE date < CURRENT_DATE - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql;

-- Note: Schedule this function to run daily using pg_cron or external scheduler
-- Example with pg_cron (if installed):
-- SELECT cron.schedule('cleanup-cache', '0 3 * * *', 'SELECT cleanup_old_cache_records()');


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
