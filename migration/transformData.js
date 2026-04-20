/**
 * Transform MongoDB data to PostgreSQL format
 * Run: node migration/transformData.js
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const EXPORT_DIR = path.join(__dirname, 'exported-data');
const TRANSFORMED_DIR = path.join(__dirname, 'transformed-data');

// Map to store MongoDB ObjectId → PostgreSQL UUID mappings
const idMappings = {
  buildings: new Map(),
  units: new Map(),
  bookings: new Map(),
  users: new Map(),
  coupons: new Map()
};

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function transformKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(transformKeys);
  }
  
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const transformed = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnakeCase(key);
      transformed[snakeKey] = transformKeys(value);
    }
    return transformed;
  }
  
  return obj;
}

function getOrCreateUUID(mongoId, collection) {
  if (!mongoId) return null;
  
  const mongoIdStr = mongoId.toString();
  
  if (!idMappings[collection].has(mongoIdStr)) {
    idMappings[collection].set(mongoIdStr, uuidv4());
  }
  
  return idMappings[collection].get(mongoIdStr);
}

async function transformBuildings() {
  console.log('\n🏢 Transforming buildings...');
  
  const data = JSON.parse(await fs.readFile(path.join(EXPORT_DIR, 'buildings.json'), 'utf8'));
  
  const transformed = data.map(building => {
    const uuid = getOrCreateUUID(building._id, 'buildings');
    
    return {
      id: uuid,
      legacy_mongo_id: building._id.toString(),
      name: building.name,
      description: building.description || '',
      location: building.location || {},
      gallery: building.gallery || [],
      amenities: building.amenities || [],
      policies: building.policies || {},
      reviews: building.reviews || [],
      total_units: building.totalUnits || 0,
      is_active: building.isActive !== false,
      is_archived: building.isArchived || false,
      created_at: building.createdAt || new Date().toISOString(),
      updated_at: building.updatedAt || new Date().toISOString()
    };
  });
  
  console.log(`   ✅ Transformed ${transformed.length} buildings`);
  return transformed;
}

async function transformUnits() {
  console.log('\n🏠 Transforming units...');
  
  const data = JSON.parse(await fs.readFile(path.join(EXPORT_DIR, 'units.json'), 'utf8'));
  
  const transformed = data.map(unit => {
    const uuid = getOrCreateUUID(unit._id, 'units');
    const buildingId = getOrCreateUUID(unit.buildingId, 'buildings');
    
    return {
      id: uuid,
      legacy_mongo_id: unit._id.toString(),
      ru_property_id: unit.ruPropertyId,
      ru_owner_id: unit.ruOwnerID || 0,
      building_id: buildingId,
      name: unit.name,
      description: unit.description || '',
      unit_number: unit.unitNumber || '',
      unit_type: unit.unitType || '',
      unit_type_slug: unit.unitTypeSlug || '',
      is_representative: unit.isRepresentative || false,
      space: unit.space || 0,
      standard_guests: unit.standardGuests || 1,
      can_sleep_max: unit.canSleepMax || 1,
      no_of_units: unit.noOfUnits || 1,
      floor: unit.floor || 0,
      property_type: unit.propertyType || {},
      pricing: unit.pricing || {},
      check_in_out: unit.checkInOut || {},
      images: unit.images || [],
      amenities: unit.amenities || [],
      composition_rooms: unit.compositionRooms || [],
      is_active: unit.isActive !== false,
      is_archived: unit.isArchived || false,
      last_synced_at: unit.lastSyncedAt || new Date().toISOString(),
      ru_last_mod: unit.ruLastMod || new Date().toISOString(),
      created_at: unit.createdAt || new Date().toISOString(),
      updated_at: unit.updatedAt || new Date().toISOString()
    };
  });
  
  console.log(`   ✅ Transformed ${transformed.length} units`);
  return transformed;
}

async function transformUsers() {
  console.log('\n👤 Transforming users...');
  
  const data = JSON.parse(await fs.readFile(path.join(EXPORT_DIR, 'users.json'), 'utf8'));
  
  const transformed = data.map(user => {
    const uuid = getOrCreateUUID(user._id, 'users');
    
    return {
      id: uuid,
      legacy_mongo_id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      address: user.address || {},
      preferences: user.preferences || {},
      created_at: user.createdAt || new Date().toISOString(),
      updated_at: user.updatedAt || new Date().toISOString()
    };
  });
  
  console.log(`   ✅ Transformed ${transformed.length} users`);
  return transformed;
}

async function transformCoupons() {
  console.log('\n🎟️  Transforming coupons...');
  
  const data = JSON.parse(await fs.readFile(path.join(EXPORT_DIR, 'coupons.json'), 'utf8'));
  
  const transformed = data.map(coupon => {
    const uuid = getOrCreateUUID(coupon._id, 'coupons');
    
    // Transform properties array to UUIDs
    const properties = (coupon.properties || []).map(propId => 
      getOrCreateUUID(propId, 'units')
    ).filter(Boolean);
    
    return {
      id: uuid,
      legacy_mongo_id: coupon._id.toString(),
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discountType,
      discount_value: coupon.discountValue,
      max_discount_amount: coupon.maxDiscountAmount || null,
      min_booking_amount: coupon.minBookingAmount || 0,
      min_nights: coupon.minNights || 0,
      valid_from: coupon.validFrom,
      valid_until: coupon.validUntil,
      usage_type: coupon.usageType || 'unlimited',
      max_total_usage: coupon.maxTotalUsage || null,
      max_usage_per_user: coupon.maxUsagePerUser || null,
      current_usage_count: coupon.currentUsageCount || 0,
      applicable_on: coupon.applicableOn || 'all',
      properties: properties,
      cities: coupon.cities || [],
      new_users_only: coupon.newUsersOnly || false,
      specific_users: coupon.specificUsers || [],
      excluded_users: coupon.excludedUsers || [],
      used_by: coupon.usedBy || [],
      is_active: coupon.isActive !== false,
      created_at: coupon.createdAt || new Date().toISOString(),
      updated_at: coupon.updatedAt || new Date().toISOString()
    };
  });
  
  console.log(`   ✅ Transformed ${transformed.length} coupons`);
  return transformed;
}

async function transformBookings() {
  console.log('\n📋 Transforming bookings...');
  
  const data = JSON.parse(await fs.readFile(path.join(EXPORT_DIR, 'bookings.json'), 'utf8'));
  
  const transformed = data.map(booking => {
    const uuid = getOrCreateUUID(booking._id, 'bookings');
    const buildingId = getOrCreateUUID(booking.buildingId, 'buildings');
    const unitId = getOrCreateUUID(booking.unitId, 'units');
    const userId = getOrCreateUUID(booking.userId, 'users');
    const couponId = getOrCreateUUID(booking.couponId, 'coupons');
    
    return {
      id: uuid,
      legacy_mongo_id: booking._id.toString(),
      booking_reference: booking.bookingReference,
      ru_reservation_id: booking.ruReservationId || null,
      user_id: userId,
      building_id: buildingId,
      unit_id: unitId,
      ru_property_id: booking.ruPropertyId,
      check_in: booking.checkIn,
      check_out: booking.checkOut,
      nights: booking.nights,
      guest_info: booking.guestInfo || {},
      number_of_guests: booking.numberOfGuests,
      number_of_adults: booking.numberOfAdults || booking.numberOfGuests,
      number_of_children: booking.numberOfChildren || 0,
      number_of_infants: booking.numberOfInfants || 0,
      pricing: booking.pricing || {},
      applied_coupon: booking.appliedCoupon || null,
      coupon_id: couponId,
      payment: booking.payment || {},
      status: booking.status || 'pending',
      ru_status: booking.ruStatus || null,
      booking_source: booking.bookingSource || 'direct',
      cancellation: booking.cancellation || null,
      special_requests: booking.specialRequests || '',
      access_token: booking.accessToken,
      token_expires_at: booking.tokenExpiresAt,
      created_at: booking.createdAt || new Date().toISOString(),
      updated_at: booking.updatedAt || new Date().toISOString()
    };
  });
  
  console.log(`   ✅ Transformed ${transformed.length} bookings`);
  return transformed;
}

async function transformPropertyDailyCache() {
  console.log('\n📅 Transforming property daily cache...');
  
  const data = JSON.parse(await fs.readFile(path.join(EXPORT_DIR, 'property_daily_cache.json'), 'utf8'));
  
  const transformed = data.map(cache => {
    const unitId = getOrCreateUUID(cache.unitId, 'units');
    
    return {
      unit_id: unitId,
      ru_property_id: cache.ruPropertyId,
      date: cache.date,
      is_available: cache.isAvailable,
      price_per_night: cache.pricePerNight,
      currency: cache.currency || 'INR',
      last_synced: cache.lastSynced || new Date().toISOString(),
      created_at: cache.createdAt || new Date().toISOString(),
      updated_at: cache.updatedAt || new Date().toISOString()
    };
  });
  
  console.log(`   ✅ Transformed ${transformed.length} cache records`);
  return transformed;
}

async function transformData() {
  try {
    console.log('🚀 Starting data transformation...');
    
    // Create transformed directory
    await fs.mkdir(TRANSFORMED_DIR, { recursive: true });
    
    // Transform in order (to build ID mappings)
    const buildings = await transformBuildings();
    await fs.writeFile(
      path.join(TRANSFORMED_DIR, 'buildings.json'),
      JSON.stringify(buildings, null, 2)
    );
    
    const units = await transformUnits();
    await fs.writeFile(
      path.join(TRANSFORMED_DIR, 'units.json'),
      JSON.stringify(units, null, 2)
    );
    
    const users = await transformUsers();
    await fs.writeFile(
      path.join(TRANSFORMED_DIR, 'users.json'),
      JSON.stringify(users, null, 2)
    );
    
    const coupons = await transformCoupons();
    await fs.writeFile(
      path.join(TRANSFORMED_DIR, 'coupons.json'),
      JSON.stringify(coupons, null, 2)
    );
    
    const bookings = await transformBookings();
    await fs.writeFile(
      path.join(TRANSFORMED_DIR, 'bookings.json'),
      JSON.stringify(bookings, null, 2)
    );
    
    const propertyDailyCache = await transformPropertyDailyCache();
    await fs.writeFile(
      path.join(TRANSFORMED_DIR, 'property_daily_cache.json'),
      JSON.stringify(propertyDailyCache, null, 2)
    );
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ TRANSFORMATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Transformed to: ${TRANSFORMED_DIR}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Transformation failed:', error);
    process.exit(1);
  }
}

transformData();
