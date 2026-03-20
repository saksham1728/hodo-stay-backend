require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('../models/Building');

async function checkBuildingNames() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const buildings = await Building.find({});
    console.log(`\n📊 Found ${buildings.length} buildings:`);
    buildings.forEach(b => {
      console.log(`  - ID: ${b._id}`);
      console.log(`    Name: "${b.name}"`);
      console.log(`    Images: ${b.images?.length || 0}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

checkBuildingNames();
