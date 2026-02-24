/**
 * Property Cache Sync Script
 * Run this daily via cron job to sync availability and pricing
 * 
 * Usage: node scripts/sync-property-cache.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const propertyCacheSync = require('../services/propertyCacheSync');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hodo-stay';

async function main() {
  try {
    console.log('🚀 Property Cache Sync Script');
    console.log('================================\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Run sync
    const result = await propertyCacheSync.syncAllUnits();

    // Cleanup old data
    console.log('\n🗑️  Cleaning up old data...');
    await propertyCacheSync.cleanupOldData();

    console.log('\n✨ Sync script completed successfully!');
    console.log(`   Total time: ${result.duration}s`);
    console.log(`   Success: ${result.successCount}`);
    console.log(`   Errors: ${result.errorCount}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
