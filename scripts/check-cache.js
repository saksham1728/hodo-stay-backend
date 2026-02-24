require('dotenv').config();
const mongoose = require('mongoose');
const PropertyDailyCache = require('../models/PropertyDailyCache');

async function checkCache() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const cache = await PropertyDailyCache.find({
      unitId: '691b609f9d03159fd4c1f6dd',
      date: {
        $gte: new Date('2026-03-25'),
        $lt: new Date('2026-03-27')
      }
    }).sort({ date: 1 });
    
    console.log('Cache records for March 25-26:');
    console.log(JSON.stringify(cache, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCache();
