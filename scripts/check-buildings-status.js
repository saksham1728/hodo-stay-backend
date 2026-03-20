const mongoose = require('mongoose');
const Building = require('../models/Building');
const Unit = require('../models/Unit');
require('dotenv').config();

async function checkBuildingsStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('='.repeat(80));
    console.log('CURRENT BUILDINGS STATUS');
    console.log('='.repeat(80));

    const allBuildings = await Building.find({});
    console.log(`\nTotal Buildings in Database: ${allBuildings.length}\n`);
    
    for (const building of allBuildings) {
      const unitCount = await Unit.countDocuments({ buildingId: building._id });
      const units = await Unit.find({ buildingId: building._id }).select('name ruPropertyId');
      
      console.log('─'.repeat(80));
      console.log(`Building: ${building.name}`);
      console.log(`  ID: ${building._id}`);
      console.log(`  Slug: ${building.slug}`);
      console.log(`  Active: ${building.isActive}`);
      console.log(`  Total Units in DB: ${unitCount}`);
      console.log(`  Created: ${building.createdAt}`);
      
      if (units.length > 0) {
        console.log(`\n  Units:`);
        units.forEach((unit, i) => {
          console.log(`    ${i + 1}. ${unit.name} (RU ID: ${unit.ruPropertyId})`);
        });
      }
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const totalUnits = await Unit.countDocuments({});
    console.log(`\nTotal Units in Database: ${totalUnits}`);
    
    const activeBuildings = allBuildings.filter(b => b.isActive);
    console.log(`Active Buildings: ${activeBuildings.length}`);
    
    activeBuildings.forEach(b => {
      console.log(`  - ${b.name} (${b.slug})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  checkBuildingsStatus()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = checkBuildingsStatus;
