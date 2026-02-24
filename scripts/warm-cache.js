/**
 * Cache Warming Script
 * Run this on server startup or deployment to ensure cache is populated
 */

require('dotenv').config();
const mongoose = require('mongoose');
const propertyCacheSync = require('../services/propertyCacheSync');
const PropertyDailyCache = require('../models/PropertyDailyCache');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hodo-stay';

async function warmCache() {
  try {
    console.log('🔥 Starting cache warming...\n');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if cache already has data
    const existingRecords = await PropertyDailyCache.countDocuments();
    console.log(`📊 Current cache records: ${existingRecords}`);

    if (existingRecords > 0) {
      console.log('ℹ️  Cache already has data. Refreshing...\n');
    } else {
      console.log('ℹ️  Cache is empty. Performing initial sync...\n');
    }

    // Run sync
    const result = await propertyCacheSync.syncAllUnits();
    
    // Clean up old data
    await propertyCacheSync.cleanupOldData();

    // Final stats
    const finalRecords = await PropertyDailyCache.countDocuments();
    console.log(`\n📊 Final cache records: ${finalRecords}`);
    console.log(`✅ Cache warming completed!`);
    console.log(`   Synced: ${result.successCount} units`);
    console.log(`   Failed: ${result.errorCount} units`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Cache warming failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

warmCache();
