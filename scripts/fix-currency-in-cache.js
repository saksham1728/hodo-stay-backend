require('dotenv').config();
const mongoose = require('mongoose');
const PropertyDailyCache = require('../models/PropertyDailyCache');

async function fixCurrencyInCache() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Update all cache records to use INR currency
    console.log('🔄 Updating all cache records to INR...');
    const result = await PropertyDailyCache.updateMany(
      { currency: { $ne: 'INR' } }, // Find all records where currency is not INR
      { $set: { currency: 'INR' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} cache records to INR`);

    // Verify the update
    const usdCount = await PropertyDailyCache.countDocuments({ currency: 'USD' });
    const inrCount = await PropertyDailyCache.countDocuments({ currency: 'INR' });
    
    console.log('\n📊 Currency distribution:');
    console.log(`   INR: ${inrCount} records`);
    console.log(`   USD: ${usdCount} records`);

    if (usdCount === 0) {
      console.log('\n✅ All cache records now use INR currency!');
    } else {
      console.log('\n⚠️  Warning: Some records still have USD currency');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixCurrencyInCache();
