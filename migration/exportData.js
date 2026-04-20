/**
 * Export MongoDB data to JSON files
 * Run: node migration/exportData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// MongoDB models
const Booking = require('../models/Booking');
const Unit = require('../models/Unit');
const Building = require('../models/Building');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const PropertyDailyCache = require('../models/PropertyDailyCache');

const EXPORT_DIR = path.join(__dirname, 'exported-data');

async function exportCollection(Model, filename) {
  console.log(`\n📦 Exporting ${filename}...`);
  
  const data = await Model.find({}).lean();
  console.log(`   Found ${data.length} records`);
  
  const filepath = path.join(EXPORT_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  console.log(`   ✅ Exported to ${filepath}`);
  
  return data.length;
}

async function exportData() {
  try {
    console.log('🚀 Starting MongoDB data export...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Create export directory
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    
    // Export all collections
    const counts = {
      buildings: await exportCollection(Building, 'buildings.json'),
      units: await exportCollection(Unit, 'units.json'),
      bookings: await exportCollection(Booking, 'bookings.json'),
      users: await exportCollection(User, 'users.json'),
      coupons: await exportCollection(Coupon, 'coupons.json'),
      propertyDailyCache: await exportCollection(PropertyDailyCache, 'property_daily_cache.json')
    };
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ EXPORT COMPLETE');
    console.log('='.repeat(60));
    console.log('Records exported:');
    Object.entries(counts).forEach(([collection, count]) => {
      console.log(`   ${collection}: ${count}`);
    });
    console.log(`\nExported to: ${EXPORT_DIR}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

exportData();
