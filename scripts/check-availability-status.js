const mongoose = require('mongoose');
const PropertyDailyCache = require('../models/PropertyDailyCache');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkAvailabilityStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get total count
    const total = await PropertyDailyCache.countDocuments();
    console.log(`📊 Total cache entries: ${total}`);

    // Count by availability
    const availableCount = await PropertyDailyCache.countDocuments({ available: true });
    const unavailableCount = await PropertyDailyCache.countDocuments({ available: false });
    
    console.log(`✅ Available: ${availableCount}`);
    console.log(`❌ Unavailable: ${unavailableCount}\n`);

    // Sample some records to see the data
    console.log('📋 Sample records:\n');
    const samples = await PropertyDailyCache.find().limit(10).lean();
    
    samples.forEach(record => {
      console.log(`Date: ${record.date.toISOString().split('T')[0]}, RU ID: ${record.ruPropertyId}, Available: ${record.available}, Price: ${record.price}`);
    });

    // Check if 'available' field exists vs 'isAvailable'
    console.log('\n🔍 Checking field names...');
    const sampleDoc = await PropertyDailyCache.findOne().lean();
    if (sampleDoc) {
      console.log('Fields in document:', Object.keys(sampleDoc));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkAvailabilityStatus();
