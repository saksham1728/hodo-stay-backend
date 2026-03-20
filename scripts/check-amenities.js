require('dotenv').config();
const mongoose = require('mongoose');

async function checkAmenities() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const buildingsCollection = db.collection('buildings');

    const buildings = await buildingsCollection.find({}).toArray();
    
    buildings.forEach(building => {
      console.log(`\n📍 ${building.name}`);
      console.log('Amenities:', JSON.stringify(building.amenities, null, 2));
      console.log('Legacy Amenities:', JSON.stringify(building.legacyAmenities, null, 2));
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkAmenities();
