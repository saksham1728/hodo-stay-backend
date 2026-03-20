const mongoose = require('mongoose');
const Building = require('../models/Building');
const Unit = require('../models/Unit');
require('dotenv').config();

async function cleanupOldBuilding() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const oldBuildingId = '691b609f9d03159fd4c1f5f6';
    const newHSRBuildingId = '69bcd4daae13231af460bfce';

    console.log('='.repeat(80));
    console.log('CHECKING OLD BUILDING');
    console.log('='.repeat(80));

    // Check old building
    const oldBuilding = await Building.findById(oldBuildingId);
    if (!oldBuilding) {
      console.log('❌ Old building not found. It may have been deleted already.');
      return;
    }

    console.log(`\nOld Building: ${oldBuilding.name}`);
    console.log(`Slug: ${oldBuilding.slug}`);
    console.log(`Total Units: ${oldBuilding.totalUnits}`);

    // Check units linked to old building
    const unitsInOldBuilding = await Unit.find({ buildingId: oldBuildingId });
    console.log(`\nUnits linked to old building: ${unitsInOldBuilding.length}`);

    if (unitsInOldBuilding.length > 0) {
      console.log('\n⚠️  Found units linked to old building:');
      unitsInOldBuilding.forEach(unit => {
        console.log(`  - ${unit.name} (RU ID: ${unit.ruPropertyId})`);
      });

      console.log('\n='.repeat(80));
      console.log('MIGRATING UNITS TO NEW HSR BUILDING');
      console.log('='.repeat(80));

      // Migrate units to new HSR building
      const result = await Unit.updateMany(
        { buildingId: oldBuildingId },
        { $set: { buildingId: newHSRBuildingId } }
      );

      console.log(`✅ Migrated ${result.modifiedCount} units to new HSR building`);

      // Update new HSR building unit count
      const newHSRUnitCount = await Unit.countDocuments({ buildingId: newHSRBuildingId });
      await Building.findByIdAndUpdate(newHSRBuildingId, { totalUnits: newHSRUnitCount });
      console.log(`✅ Updated HSR building unit count to ${newHSRUnitCount}`);
    }

    console.log('\n='.repeat(80));
    console.log('DELETING OLD BUILDING');
    console.log('='.repeat(80));

    await Building.findByIdAndDelete(oldBuildingId);
    console.log(`✅ Deleted old building: ${oldBuilding.name}`);

    console.log('\n='.repeat(80));
    console.log('FINAL STATUS');
    console.log('='.repeat(80));

    const allBuildings = await Building.find({ isActive: true });
    console.log(`\nActive Buildings: ${allBuildings.length}`);
    
    for (const building of allBuildings) {
      const unitCount = await Unit.countDocuments({ buildingId: building._id });
      console.log(`\n${building.name}`);
      console.log(`  ID: ${building._id}`);
      console.log(`  Slug: ${building.slug}`);
      console.log(`  Units: ${unitCount}`);
    }

    console.log('\n✅ Cleanup complete!');

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
  cleanupOldBuilding()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = cleanupOldBuilding;
