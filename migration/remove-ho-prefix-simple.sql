-- ============================================================================
-- REMOVE "ho_" PREFIX FROM ALL TABLE NAMES (SIMPLE VERSION)
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Rename tables
ALTER TABLE IF EXISTS ho_buildings RENAME TO buildings;
ALTER TABLE IF EXISTS ho_units RENAME TO units;
ALTER TABLE IF EXISTS ho_users RENAME TO users;
ALTER TABLE IF EXISTS ho_coupons RENAME TO coupons;
ALTER TABLE IF EXISTS ho_coupon_usage RENAME TO coupon_usage;
ALTER TABLE IF EXISTS ho_bookings RENAME TO bookings;
ALTER TABLE IF EXISTS ho_property_daily_cache RENAME TO property_daily_cache;

-- 2. Rename indexes (only the ones with ho_ prefix)
ALTER INDEX IF EXISTS idx_ho_buildings_slug RENAME TO idx_buildings_slug;
ALTER INDEX IF EXISTS idx_ho_buildings_active RENAME TO idx_buildings_active;
ALTER INDEX IF EXISTS idx_ho_buildings_city RENAME TO idx_buildings_city;
ALTER INDEX IF EXISTS idx_ho_buildings_state RENAME TO idx_buildings_state;

ALTER INDEX IF EXISTS idx_ho_units_ru_property_id RENAME TO idx_units_ru_property_id;
ALTER INDEX IF EXISTS idx_ho_units_building_id RENAME TO idx_units_building_id;
ALTER INDEX IF EXISTS idx_ho_units_unit_type RENAME TO idx_units_unit_type;
ALTER INDEX IF EXISTS idx_ho_units_active RENAME TO idx_units_active;

ALTER INDEX IF EXISTS idx_ho_users_email RENAME TO idx_users_email;
ALTER INDEX IF EXISTS idx_ho_users_phone RENAME TO idx_users_phone;

ALTER INDEX IF EXISTS idx_ho_coupons_code RENAME TO idx_coupons_code;
ALTER INDEX IF EXISTS idx_ho_coupons_validity RENAME TO idx_coupons_validity;
ALTER INDEX IF EXISTS idx_ho_coupons_used_by RENAME TO idx_coupons_used_by;

ALTER INDEX IF EXISTS idx_ho_bookings_user_id RENAME TO idx_bookings_user_id;
ALTER INDEX IF EXISTS idx_ho_bookings_building_id RENAME TO idx_bookings_building_id;
ALTER INDEX IF EXISTS idx_ho_bookings_unit_id RENAME TO idx_bookings_unit_id;
ALTER INDEX IF EXISTS idx_ho_bookings_check_in RENAME TO idx_bookings_check_in;
ALTER INDEX IF EXISTS idx_ho_bookings_check_out RENAME TO idx_bookings_check_out;
ALTER INDEX IF EXISTS idx_ho_bookings_status RENAME TO idx_bookings_status;
ALTER INDEX IF EXISTS idx_ho_bookings_source RENAME TO idx_bookings_source;
ALTER INDEX IF EXISTS idx_ho_bookings_email RENAME TO idx_bookings_email;
ALTER INDEX IF EXISTS idx_ho_bookings_order_id RENAME TO idx_bookings_order_id;
ALTER INDEX IF EXISTS idx_ho_bookings_access_token RENAME TO idx_bookings_access_token;
ALTER INDEX IF EXISTS idx_ho_bookings_created_at RENAME TO idx_bookings_created_at;

ALTER INDEX IF EXISTS idx_ho_cache_unit_id RENAME TO idx_cache_unit_id;
ALTER INDEX IF EXISTS idx_ho_cache_date RENAME TO idx_cache_date;
ALTER INDEX IF EXISTS idx_ho_cache_available RENAME TO idx_cache_available;
ALTER INDEX IF EXISTS idx_ho_cache_ru_property RENAME TO idx_cache_ru_property;

-- 3. Rename triggers
DROP TRIGGER IF EXISTS update_ho_buildings_updated_at ON buildings;
CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ho_units_updated_at ON units;
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ho_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ho_coupons_updated_at ON coupons;
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ho_coupon_usage_updated_at ON coupon_usage;
CREATE TRIGGER update_coupon_usage_updated_at BEFORE UPDATE ON coupon_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ho_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ho_property_daily_cache_updated_at ON property_daily_cache;
CREATE TRIGGER update_property_daily_cache_updated_at BEFORE UPDATE ON property_daily_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'Tables renamed successfully!' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('buildings', 'units', 'users', 'coupons', 'coupon_usage', 'bookings', 'property_daily_cache')
ORDER BY table_name;
