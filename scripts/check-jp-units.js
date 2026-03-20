require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('../models/Building');
const Unit = require('../models/Unit');

async function checkJPUnits() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const jpBuilding = await Building.findOne({ name: 'Hodo Stays JP Nagar' });
    console.log('\n📍 JP Nagar Building ID:', jpBuilding._id);

    const jpUnits = await Unit.find({ buildingId: jpBuilding._id });
    console.log(`\n📊 Found ${jpUnits.length} JP Nagar units:`);
    
    jpUnits.forEach(unit => {
      console.log(`\n  Unit: ${unit.name}`);
      console.log(`  Images: ${unit.images?.length || 0}`);
      if (unit.images && unit.images.length > 0) {
        console.log(`  First image: ${unit.images[0]}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkJPUnits();
