/**
 * Data Transformation Module
 * Transforms MongoDB documents to PostgreSQL format
 * Task 12.2: Create data transformation module
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, 'data');
const transformedDir = path.join(__dirname, 'data', 'transformed');

// Create transformed directory
if (!fs.existsSync(transformedDir)) {
  fs.mkdirSync(transformedDir, { recursive: true });
}

// Store ID mappings for foreign key references
const idMappings = {
  buildings: new Map(),
  units: new Map(),
  users: new Map(),
  coupons: new Map()
};

/**
 * Convert MongoDB ObjectId to UUID and store mapping
 */
function convertId(mongoId, collection) {
  if (!mongoId) return null;
  
  const mongoIdStr = mongoId.toString();
  
  if (idMappings[collection] && idMappings[collection].has(mongoIdStr)) {
    return idMappings[collection].get(mongoIdStr);
  }
  
  const uuid = uuidv4();
  if (idMappings[collection]) {
    idMappings[collection].set(mongoIdStr, uuid);
  }
  
  return uuid;
}

/**
 * Convert camelCase to snake_case
 */
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Transform object keys from camelCase to snake_case
 */
function transformKeys(obj, keepAsJsonb = []) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => transformKeys(item, keepAsJsonb));
  
  const transformed = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip MongoDB internal fields
    if (key === '__v') continue;
    
    const snakeKey = toSnakeCase(key);
    
    // Keep certain fields as JSONB (don't transform nested keys)
    if (keepAsJsonb.includes(key)) {
      transformed[snakeKey] = value;
    } else {
      transformed[snakeKey] = transformKeys(value, keepAsJsonb);
    }
  }
  
  return transformed;
}

/**
 * Transform Building document
 */
function transformBuilding(doc) {
  const uuid = convertId(doc._id, 'buildings');
  
  return {
    id: uuid,
    legacy_mongo_id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    title: doc.title,
    sub_title: doc.subTitle,
    description: doc.description,
    location: doc.location || {},
    legacy_location: doc.legacyLocation || null,
    hero_image: doc.heroImage,
    gallery: doc.gallery || [],
    images: doc.images || [],
    highlights: doc.highlights || [],
    amenities: doc.amenities || [],
    legacy_amenities: doc.legacyAmenities || [],
    accessibility: doc.accessibility || null,
    policies: doc.policies || [],
    review_summary: doc.reviewSummary || null,
    reviews: doc.reviews || [],
    room_types: doc.roomTypes || [],
    seo: doc.seo || null,
    total_units: doc.totalUnits || 0,
    is_active: doc.isActive !== false,
    created_at: doc.createdAt || new Date(),
    updated_at: doc.updatedAt || new Date()
  };
}

/**
 * Transform Unit document
 */
function transformUnit(doc) {
  const uuid = convertId(doc._id, 'units');
  const buildingId = convertId(doc.buildingId, 'buildings');
  
  return {
    id: uuid,
    legacy_mongo_id: doc._id.toString(),
    ru_property_id: doc.ruPropertyId,
    ru_owner_id: doc.ruOwnerID,
    building_id: buildingId,
    name: doc.name,
    description: doc.description,
    unit_type: doc.unitType,
    unit_type_slug: doc.unitTypeSlug,
    is_representative: doc.isRepresentative || false,
    space: doc.space,
    standard_guests: doc.standardGuests || 1,
    can_sleep_max: doc.canSleepMax || 1,
    no_of_units: doc.noOfUnits || 1,
    floor: doc.floor,
    property_type: doc.propertyType || null,
    pricing: doc.pricing || null,
    check_in_out: doc.checkInOut || null,
    images: doc.images || [],
    amenities: doc.amenities || [],
    composition_rooms: doc.compositionRooms || [],
    is_active: doc.isActive !== false,
    is_archived: doc.isArchived || false,
    last_synced_at: doc.lastSyncedAt || new Date(),
    ru_last_mod: doc.ruLastMod || null,
    created_at: doc.createdAt || new Date(),
    updated_at: doc.updatedAt || new Date()
  };
}

/**
 * Transform User document
 */
function transformUser(doc) {
  const uuid = convertId(doc._id, 'users');
  
  return {
    id: uuid,
    legacy_mongo_id: doc._id.toString(),
    first_name: doc.firstName,
    last_name: doc.lastName,
    email: doc.email,
    phone: doc.phone,
    address: doc.address || null,
    preferences: doc.preferences || null,
    is_active: doc.isActive !== false,
    total_bookings: doc.totalBookings || 0,
    created_at: doc.createdAt || new Date(),
    updated_at: doc.updatedAt || new Date()
  };
}

/**
 * Transform Booking document
 */
function transformBooking(doc) {
  const uuid = uuidv4(); // New UUID for each booking
  const userId = doc.userId ? convertId(doc.userId, 'users') : null;
  const buildingId = convertId(doc.buildingId, 'buildings');
  const unitId = convertId(doc.unitId, 'units');
  const couponId = doc.couponId ? convertId(doc.couponId, 'coupons') : null;
  
  return {
    id: uuid,
    legacy_mongo_id: doc._id.toString(),
    booking_reference: doc.bookingReference,
    ru_reservation_id: doc.ruReservationId || null,
    user_id: userId,
    building_id: buildingId,
    unit_id: unitId,
    ru_property_id: doc.ruPropertyId,
    check_in: doc.checkIn,
    check_out: doc.checkOut,
    nights: doc.nights,
    guest_info: doc.guestInfo || {},
    number_of_guests: doc.numberOfGuests,
    number_of_adults: doc.numberOfAdults || 1,
    number_of_children: doc.numberOfChildren || 0,
    number_of_infants: doc.numberOfInfants || 0,
    pricing: doc.pricing || {},
    applied_coupon: doc.appliedCoupon || null,
    coupon_id: couponId,
    payment: doc.payment || null,
    status: doc.status || 'pending',
    ru_status: doc.ruStatus || null,
    booking_source: doc.bookingSource || 'direct',
    cancellation: doc.cancellation || null,
    special_requests: doc.specialRequests || null,
    access_token: doc.accessToken || null,
    token_expires_at: doc.tokenExpiresAt || null,
    created_at: doc.createdAt || new Date(),
    updated_at: doc.updatedAt || new Date()
  };
}

/**
 * Transform Coupon document
 */
function transformCoupon(doc) {
  const uuid = convertId(doc._id, 'coupons');
  
  // Transform property IDs if they exist
  const properties = doc.properties 
    ? doc.properties.map(id => convertId(id, 'units'))
    : [];
  
  return {
    id: uuid,
    legacy_mongo_id: doc._id.toString(),
    code: doc.code,
    description: doc.description,
    is_active: doc.isActive !== false,
    discount_type: doc.discountType,
    discount_value: doc.discountValue,
    max_discount_amount: doc.maxDiscountAmount || null,
    usage_type: doc.usageType || 'unlimited',
    max_total_usage: doc.maxTotalUsage || null,
    max_usage_per_user: doc.maxUsagePerUser || 1,
    current_usage_count: doc.currentUsageCount || 0,
    used_by: doc.usedBy || [],
    new_users_only: doc.newUsersOnly || false,
    specific_users: doc.specificUsers || [],
    excluded_users: doc.excludedUsers || [],
    applicable_on: doc.applicableOn || 'all',
    properties: properties,
    cities: doc.cities || [],
    valid_from: doc.validFrom || new Date(),
    valid_until: doc.validUntil,
    min_booking_amount: doc.minBookingAmount || 0,
    min_nights: doc.minNights || 1,
    created_by: doc.createdBy || 'admin',
    notes: doc.notes || null,
    created_at: doc.createdAt || new Date(),
    updated_at: doc.updatedAt || new Date()
  };
}

/**
 * Transform PropertyDailyCache document
 */
function transformPropertyDailyCache(doc) {
  const unitId = convertId(doc.unitId, 'units');
  
  return {
    id: uuidv4(),
    unit_id: unitId,
    ru_property_id: doc.ruPropertyId,
    date: doc.date,
    is_available: doc.isAvailable !== false,
    price_per_night: doc.pricePerNight || 0,
    currency: doc.currency || 'INR',
    last_synced: doc.lastSynced || new Date(),
    created_at: doc.createdAt || new Date(),
    updated_at: doc.updatedAt || new Date()
  };
}

/**
 * Transform a collection
 */
function transformCollection(collectionName, transformFn) {
  console.log(`\n🔄 Transforming ${collectionName}...`);
  
  try {
    const inputPath = path.join(dataDir, `${collectionName}.json`);
    const outputPath = path.join(transformedDir, `${collectionName}.json`);
    
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const transformed = data.map(transformFn);
    
    fs.writeFileSync(outputPath, JSON.stringify(transformed, null, 2));
    
    console.log(`✅ Transformed ${transformed.length} documents`);
    console.log(`   Saved to: ${outputPath}`);
    
    return { collection: collectionName, count: transformed.length };
  } catch (error) {
    console.error(`❌ Error transforming ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Main transformation function
 */
async function transformAllData() {
  console.log('🚀 Starting data transformation...\n');
  
  const startTime = Date.now();
  const results = [];
  
  try {
    // Transform in order to build ID mappings correctly
    // 1. Buildings first (no dependencies)
    results.push(transformCollection('buildings', transformBuilding));
    
    // 2. Units (depends on buildings)
    results.push(transformCollection('units', transformUnit));
    
    // 3. Users (no dependencies)
    results.push(transformCollection('users', transformUser));
    
    // 4. Coupons (may reference units)
    results.push(transformCollection('coupons', transformCoupon));
    
    // 5. Bookings (depends on buildings, units, users, coupons)
    results.push(transformCollection('bookings', transformBooking));
    
    // 6. Property daily cache (depends on units)
    results.push(transformCollection('property_daily_cache', transformPropertyDailyCache));
    
    // Save ID mappings for reference
    const mappingsPath = path.join(transformedDir, 'id-mappings.json');
    const mappingsObj = {};
    for (const [collection, map] of Object.entries(idMappings)) {
      mappingsObj[collection] = Object.fromEntries(map);
    }
    fs.writeFileSync(mappingsPath, JSON.stringify(mappingsObj, null, 2));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TRANSFORMATION SUMMARY');
    console.log('='.repeat(60));
    results.forEach(r => {
      console.log(`${r.collection.padEnd(25)} ${r.count.toString().padStart(6)} documents`);
    });
    console.log('='.repeat(60));
    console.log(`Duration:                 ${duration}s`);
    console.log(`ID mappings saved to:     ${mappingsPath}`);
    console.log('='.repeat(60));
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Transformation failed:', error);
    throw error;
  }
}

// Run transformation if called directly
if (require.main === module) {
  transformAllData()
    .then(() => {
      console.log('\n✅ Transformation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Transformation failed:', error);
      process.exit(1);
    });
}

module.exports = { transformAllData };
