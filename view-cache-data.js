/**
 * View Cache Data - Extract 181 days of cached pricing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PropertyDailyCache = require('./models/PropertyDailyCache');
const Unit = require('./models/Unit');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hodo-stay';

async function viewCacheData() {
  try {
    console.log('📊 Viewing Cache Data\n');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find a unit that has cached data
    const unitWithCache = await PropertyDailyCache.findOne({});
    
    if (!unitWithCache) {
      console.log('❌ No cache data found in database');
      console.log('💡 Run: npm run cache:warm to populate cache');
      process.exit(0);
    }

    // Get the unit details
    const unit = await Unit.findById(unitWithCache.unitId);

    if (!unit) {
      console.log('❌ Unit not found for cached data');
      process.exit(0);
    }

    console.log('🏠 Unit Details:');
    console.log(`   Name: ${unit.name}`);
    console.log(`   ID: ${unit._id}`);
    console.log(`   RU Property ID: ${unit.ruPropertyId}`);
    console.log(`   Room Type: ${unit.roomType}\n`);

    // Get all cached records for this unit
    const cachedRecords = await PropertyDailyCache.find({ 
      unitId: unit._id 
    }).sort({ date: 1 });

    console.log(`📅 Total Cached Days: ${cachedRecords.length}\n`);

    // Display first 10 days
    console.log('=' .repeat(80));
    console.log('FIRST 10 DAYS OF CACHE DATA');
    console.log('=' .repeat(80));
    console.log('Date         | Available | Price (INR) | Last Synced');
    console.log('-' .repeat(80));

    cachedRecords.slice(0, 10).forEach(record => {
      const date = record.date.toISOString().split('T')[0];
      const available = record.isAvailable ? '✅ Yes' : '❌ No ';
      const price = `₹${record.pricePerNight.toFixed(2)}`;
      const synced = record.lastSynced.toISOString().split('T')[0];
      
      console.log(`${date} | ${available}    | ${price.padEnd(12)} | ${synced}`);
    });

    console.log('\n');

    // Display last 10 days
    console.log('=' .repeat(80));
    console.log('LAST 10 DAYS OF CACHE DATA');
    console.log('=' .repeat(80));
    console.log('Date         | Available | Price (INR) | Last Synced');
    console.log('-' .repeat(80));

    cachedRecords.slice(-10).forEach(record => {
      const date = record.date.toISOString().split('T')[0];
      const available = record.isAvailable ? '✅ Yes' : '❌ No ';
      const price = `₹${record.pricePerNight.toFixed(2)}`;
      const synced = record.lastSynced.toISOString().split('T')[0];
      
      console.log(`${date} | ${available}    | ${price.padEnd(12)} | ${synced}`);
    });

    // Statistics
    console.log('\n');
    console.log('=' .repeat(80));
    console.log('STATISTICS');
    console.log('=' .repeat(80));

    const availableDays = cachedRecords.filter(r => r.isAvailable).length;
    const unavailableDays = cachedRecords.length - availableDays;
    const prices = cachedRecords.map(r => r.pricePerNight);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    console.log(`Total Days Cached:     ${cachedRecords.length}`);
    console.log(`Available Days:        ${availableDays} (${(availableDays/cachedRecords.length*100).toFixed(1)}%)`);
    console.log(`Unavailable Days:      ${unavailableDays} (${(unavailableDays/cachedRecords.length*100).toFixed(1)}%)`);
    console.log(`\nPrice Range:`);
    console.log(`   Minimum:            ₹${minPrice.toFixed(2)}`);
    console.log(`   Maximum:            ₹${maxPrice.toFixed(2)}`);
    console.log(`   Average:            ₹${avgPrice.toFixed(2)}`);

    // Date range
    const firstDate = cachedRecords[0].date.toISOString().split('T')[0];
    const lastDate = cachedRecords[cachedRecords.length - 1].date.toISOString().split('T')[0];
    console.log(`\nDate Range:`);
    console.log(`   From:               ${firstDate}`);
    console.log(`   To:                 ${lastDate}`);

    // Sample booking calculation
    console.log('\n');
    console.log('=' .repeat(80));
    console.log('SAMPLE BOOKING CALCULATION (3 nights from today)');
    console.log('=' .repeat(80));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const bookingDays = cachedRecords.filter(r => {
      const recordDate = new Date(r.date);
      return recordDate >= today && recordDate < threeDaysLater;
    });

    if (bookingDays.length === 3) {
      console.log(`Check-in:  ${today.toISOString().split('T')[0]}`);
      console.log(`Check-out: ${threeDaysLater.toISOString().split('T')[0]}`);
      console.log(`Nights:    3\n`);

      let totalPrice = 0;
      bookingDays.forEach((day, idx) => {
        const date = day.date.toISOString().split('T')[0];
        const price = day.pricePerNight;
        totalPrice += price;
        console.log(`Night ${idx + 1} (${date}): ₹${price.toFixed(2)}`);
      });

      console.log(`\nTotal Price: ₹${totalPrice.toFixed(2)}`);
      console.log(`Avg/Night:   ₹${(totalPrice / 3).toFixed(2)}`);
    } else {
      console.log('⚠️  Not enough cache data for sample booking');
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

viewCacheData();
