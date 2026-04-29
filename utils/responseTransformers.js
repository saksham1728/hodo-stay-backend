/**
 * Response Transformers
 * 
 * Converts PostgreSQL/Supabase responses to match MongoDB/Mongoose format
 * Ensures zero changes needed in the frontend
 * 
 * Key transformations:
 * - snake_case → camelCase
 * - JSONB parsing
 * - Date formatting (ISO 8601)
 * - Field name mapping
 */

/**
 * Convert snake_case to camelCase
 * @param {string} str - Snake case string
 * @returns {string} Camel case string
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Transform object keys from snake_case to camelCase
 * @param {Object} obj - Object with snake_case keys
 * @returns {Object} Object with camelCase keys
 */
function transformKeys(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys);

  const transformed = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    transformed[camelKey] = transformKeys(value);
  }
  return transformed;
}

/**
 * Format date to ISO 8601 string
 * @param {Date|string} date - Date object or string
 * @returns {string|null} ISO 8601 formatted date string
 */
function formatDate(date) {
  if (!date) return null;
  if (typeof date === 'string') return date; // Already formatted
  return new Date(date).toISOString();
}

/**
 * Transform Booking response from PostgreSQL to MongoDB format
 * @param {Object} pgBooking - PostgreSQL booking record
 * @returns {Object} MongoDB-compatible booking object
 */
function transformBooking(pgBooking) {
  if (!pgBooking) return null;

  const booking = {
    id: pgBooking.id,
    _id: pgBooking.id, // For backward compatibility
    bookingReference: pgBooking.booking_reference,
    ruReservationId: pgBooking.ru_reservation_id,
    userId: pgBooking.user_id,
    buildingId: pgBooking.building_id,
    unitId: pgBooking.unit_id,
    ruPropertyId: pgBooking.ru_property_id,
    
    // Dates
    checkIn: formatDate(pgBooking.check_in),
    checkOut: formatDate(pgBooking.check_out),
    nights: pgBooking.nights,
    
    // Guest info (already parsed from JSONB)
    guestInfo: pgBooking.guest_info,
    
    // Guest counts
    numberOfGuests: pgBooking.number_of_guests,
    numberOfAdults: pgBooking.number_of_adults,
    numberOfChildren: pgBooking.number_of_children,
    numberOfInfants: pgBooking.number_of_infants,
    
    // Pricing (already parsed from JSONB)
    pricing: pgBooking.pricing,
    
    // Coupon
    appliedCoupon: pgBooking.applied_coupon,
    couponId: pgBooking.coupon_id,
    
    // Payment (already parsed from JSONB)
    payment: pgBooking.payment,
    
    // Status
    status: pgBooking.status,
    ruStatus: pgBooking.ru_status,
    bookingSource: pgBooking.booking_source,
    
    // Cancellation (already parsed from JSONB)
    cancellation: pgBooking.cancellation,
    
    // Special requests
    specialRequests: pgBooking.special_requests,
    
    // Access token
    accessToken: pgBooking.access_token,
    tokenExpiresAt: formatDate(pgBooking.token_expires_at),
    
    // Timestamps
    createdAt: formatDate(pgBooking.created_at),
    updatedAt: formatDate(pgBooking.updated_at)
  };

  // Add populated unit data if present
  if (pgBooking.ho_units) {
    booking.unit = transformUnit(pgBooking.ho_units);
  }

  // Add populated building data if present
  if (pgBooking.ho_buildings) {
    booking.building = transformBuilding(pgBooking.ho_buildings);
  }

  return booking;
}

/**
 * Transform Unit response from PostgreSQL to MongoDB format
 * @param {Object} pgUnit - PostgreSQL unit record
 * @returns {Object} MongoDB-compatible unit object
 */
function transformUnit(pgUnit) {
  if (!pgUnit) return null;

  return {
    id: pgUnit.id,
    _id: pgUnit.id,
    ruPropertyId: pgUnit.ru_property_id,
    ruOwnerID: pgUnit.ru_owner_id,
    buildingId: pgUnit.building_id,
    
    // Unit details
    name: pgUnit.name,
    description: pgUnit.description,
    unitType: pgUnit.unit_type,
    unitTypeSlug: pgUnit.unit_type_slug,
    isRepresentative: pgUnit.is_representative,
    
    // Specifications
    space: pgUnit.space,
    standardGuests: pgUnit.standard_guests,
    canSleepMax: pgUnit.can_sleep_max,
    noOfUnits: pgUnit.no_of_units,
    floor: pgUnit.floor,
    
    // JSONB fields (already parsed)
    propertyType: pgUnit.property_type,
    pricing: pgUnit.pricing,
    checkInOut: pgUnit.check_in_out,
    images: pgUnit.images,
    amenities: pgUnit.amenities,
    compositionRooms: pgUnit.composition_rooms,
    
    // Status
    isActive: pgUnit.is_active,
    isArchived: pgUnit.is_archived,
    
    // Sync info
    lastSyncedAt: formatDate(pgUnit.last_synced_at),
    ruLastMod: formatDate(pgUnit.ru_last_mod),
    
    // Timestamps
    createdAt: formatDate(pgUnit.created_at),
    updatedAt: formatDate(pgUnit.updated_at)
  };
}

/**
 * Transform Building response from PostgreSQL to MongoDB format
 * @param {Object} pgBuilding - PostgreSQL building record
 * @returns {Object} MongoDB-compatible building object
 */
function transformBuilding(pgBuilding) {
  if (!pgBuilding) return null;

  return {
    id: pgBuilding.id,
    _id: pgBuilding.id,
    slug: pgBuilding.slug,
    
    // Basic info
    name: pgBuilding.name,
    title: pgBuilding.title,
    subTitle: pgBuilding.sub_title,
    description: pgBuilding.description,
    
    // Location (already parsed from JSONB)
    location: pgBuilding.location,
    legacyLocation: pgBuilding.legacy_location,
    
    // Media
    heroImage: pgBuilding.hero_image,
    gallery: pgBuilding.gallery,
    images: pgBuilding.images,
    
    // Highlights (PostgreSQL array)
    highlights: pgBuilding.highlights,
    
    // JSONB fields (already parsed)
    amenities: pgBuilding.amenities,
    legacyAmenities: pgBuilding.legacy_amenities,
    accessibility: pgBuilding.accessibility,
    policies: pgBuilding.policies,
    reviewSummary: pgBuilding.review_summary,
    reviews: pgBuilding.reviews,
    roomTypes: pgBuilding.room_types,
    seo: pgBuilding.seo,
    
    // Building details
    totalUnits: pgBuilding.total_units,
    
    // Status
    isActive: pgBuilding.is_active,
    
    // Timestamps
    createdAt: formatDate(pgBuilding.created_at),
    updatedAt: formatDate(pgBuilding.updated_at)
  };
}

/**
 * Transform User response from PostgreSQL to MongoDB format
 * @param {Object} pgUser - PostgreSQL user record
 * @returns {Object} MongoDB-compatible user object
 */
function transformUser(pgUser) {
  if (!pgUser) return null;

  return {
    id: pgUser.id,
    _id: pgUser.id,
    firstName: pgUser.first_name,
    lastName: pgUser.last_name,
    email: pgUser.email,
    phone: pgUser.phone,
    
    // JSONB fields (already parsed)
    address: pgUser.address,
    preferences: pgUser.preferences,
    
    // Status
    isActive: pgUser.is_active,
    totalBookings: pgUser.total_bookings,
    
    // Timestamps
    createdAt: formatDate(pgUser.created_at),
    updatedAt: formatDate(pgUser.updated_at)
  };
}

/**
 * Transform Coupon response from PostgreSQL to MongoDB format
 * @param {Object} pgCoupon - PostgreSQL coupon record
 * @returns {Object} MongoDB-compatible coupon object
 */
function transformCoupon(pgCoupon) {
  if (!pgCoupon) return null;

  return {
    id: pgCoupon.id,
    _id: pgCoupon.id,
    code: pgCoupon.code,
    description: pgCoupon.description,
    isActive: pgCoupon.is_active,
    
    // Discount config
    discountType: pgCoupon.discount_type,
    discountValue: pgCoupon.discount_value,
    maxDiscountAmount: pgCoupon.max_discount_amount,
    
    // Usage restrictions
    usageType: pgCoupon.usage_type,
    maxTotalUsage: pgCoupon.max_total_usage,
    maxUsagePerUser: pgCoupon.max_usage_per_user,
    currentUsageCount: pgCoupon.current_usage_count,
    
    // Usage tracking (already parsed from JSONB)
    usedBy: pgCoupon.used_by,
    
    // User eligibility
    newUsersOnly: pgCoupon.new_users_only,
    specificUsers: pgCoupon.specific_users,
    excludedUsers: pgCoupon.excluded_users,
    
    // Scope restrictions
    applicableOn: pgCoupon.applicable_on,
    properties: pgCoupon.properties,
    cities: pgCoupon.cities,
    
    // Validity period
    validFrom: formatDate(pgCoupon.valid_from),
    validUntil: formatDate(pgCoupon.valid_until),
    
    // Minimum requirements
    minBookingAmount: pgCoupon.min_booking_amount,
    minNights: pgCoupon.min_nights,
    
    // Metadata
    createdBy: pgCoupon.created_by,
    notes: pgCoupon.notes,
    
    // Timestamps
    createdAt: formatDate(pgCoupon.created_at),
    updatedAt: formatDate(pgCoupon.updated_at)
  };
}

/**
 * Transform PropertyDailyCache response from PostgreSQL to MongoDB format
 * @param {Object} pgCache - PostgreSQL cache record
 * @returns {Object} MongoDB-compatible cache object
 */
function transformPropertyDailyCache(pgCache) {
  if (!pgCache) return null;

  return {
    id: pgCache.id,
    _id: pgCache.id,
    unitId: pgCache.unit_id,
    ruPropertyId: pgCache.ru_property_id,
    date: formatDate(pgCache.date),
    isAvailable: pgCache.is_available,
    pricePerNight: pgCache.price_per_night,
    currency: pgCache.currency,
    lastSynced: formatDate(pgCache.last_synced),
    createdAt: formatDate(pgCache.created_at),
    updatedAt: formatDate(pgCache.updated_at)
  };
}

/**
 * Transform array of records
 * @param {Array} records - Array of PostgreSQL records
 * @param {Function} transformer - Transformer function to apply
 * @returns {Array} Array of transformed records
 */
function transformArray(records, transformer) {
  if (!Array.isArray(records)) return [];
  return records.map(transformer);
}

module.exports = {
  transformBooking,
  transformUnit,
  transformBuilding,
  transformUser,
  transformCoupon,
  transformPropertyDailyCache,
  transformArray,
  transformKeys,
  snakeToCamel,
  formatDate
};
