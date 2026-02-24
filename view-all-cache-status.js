/**
 * View All Cache Status - Complete overview of all units
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PropertyDailyCache = require('./models/PropertyDailyCache');
const Unit = require('./models/Unit');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hodo-stay';

async function viewAllCacheStatus() {
  try {
    console.log('📊 Complete Cache Status Report\n');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all active units
    const units = await Unit.find({ 
      isActive: true, 
      ruPropertyId: { $exists: true, $ne: null } 
    });

    console.log(`🏠 Total Active Units: ${units.length}\n`);
    console.log('=' .repeat(100));
    console.log('UNIT CACHE STATUS');
    console.log('=' .repeat(100));
    console.log('Unit Name'.padEnd(50) + ' | RU ID    | Cached Days | Available | Status');
    console.log('-' .repeat(100));

    let totalCached = 0;
    let unitsWithCache = 0;
    let unitsWithoutCache = 0;

    for (const unit of units) {
      const cacheCount = await PropertyDailyCache.countDocuments({ unitId: unit._id });
      const availableCount = await PropertyDailyCache.countDocuments({ 
        unitId: unit._id, 
        isAvailable: true 
      });

      totalCached += cacheCount;
      
      const unitName = unit.name.substring(0, 48);
      const ruId = unit.ruPropertyId;
      const status = cacheCount > 0 ? '✅ Synced' : '❌ No Data';
      
      if (cacheCount > 0) {
        unitsWithCache++;
      } else {
        unitsWithoutCache++;
      }

      console.log(
        unitName.padEnd(50) + 
        ' | ' + ruId.padEnd(8) + 
        ' | ' + String(cacheCount).padStart(11) + 
        ' | ' + String(availableCount).padStart(9) + 
        ' | ' + status
      );
    }

    console.log('\n');
    console.log('=' .repeat(100));
    console.log('SUMMARY');
    console.log('=' .repeat(100));
    console.log(`Total Units:              ${units.length}`);
    console.log(`Units with Cache:         ${unitsWithCache} ✅`);
    console.log(`Units without Cache:      ${unitsWithoutCache} ❌`);
    console.log(`Total Cached Records:     ${totalCached}`);
    console.log(`Expected Records:         ${units.length * 181} (${units.length} units × 181 days)`);
    console.log(`Missing Records:          ${(units.length * 181) - totalCached}`);

    // Get date range of cached data
    const oldestRecord = await PropertyDailyCache.findOne().sort({ date: 1 });
    const newestRecord = await PropertyDailyCache.findOne().sort({ date: -1 });

    if (oldestRecord && newestRecord) {
      console.log(`\nCache Date Range:`);
      console.log(`   From:                  ${oldestRecord.date.toISOString().split('T')[0]}`);
      console.log(`   To:                    ${newestRecord.date.toISOString().split('T')[0]}`);
    }

    // Last sync time
    const lastSyncRecord = await PropertyDailyCache.findOne().sort({ lastSynced: -1 });
    if (lastSyncRecord) {
      console.log(`\nLast Sync:                ${lastSyncRecord.lastSynced.toISOString()}`);
    }

    console.log('\n✅ Done!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

viewAllCacheStatus();
