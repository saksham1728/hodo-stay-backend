const mongoose = require('mongoose');
const Unit = require('./models/Unit');
const PropertyDailyCache = require('./models/PropertyDailyCache');

async function checkSyncStatus() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hodo-stay');
    
    const units = await Unit.find({ 
      isActive: true, 
      ruPropertyId: { $exists: true } 
    });
    
    console.log('📊 Sync Status Report\n');
    console.log('Units with RU Property IDs:');
    
    let totalRecords = 0;
    for (const unit of units) {
      const count = await PropertyDailyCache.countDocuments({ unitId: unit._id });
      totalRecords += count;
      const status = count === 181 ? '✅' : '❌';
      console.log(`${status} ${unit.name} (${unit.ruPropertyId}): ${count} records`);
    }
    
    console.log(`\nTotal: ${totalRecords} records`);
    console.log(`Expected: ${units.length * 181} records (${units.length} units × 181 days)`);
    console.log(`Missing: ${(units.length * 181) - totalRecords} records`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSyncStatus();
