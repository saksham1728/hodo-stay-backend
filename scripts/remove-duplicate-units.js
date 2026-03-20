const mongoose = require('mongoose');
const Unit = require('../models/Unit');
const Building = require('../models/Building');
require('dotenv').config();

// Valid RU Property IDs from Rentals United API
const VALID_HSR_IDS = [
  3894210, 3894211, 3894213, 3894214, 3894215,
  3894216, 3894217, 3894219, 3904648, 3905815
];

const VALID_JPN_IDS = [
  4485194, 4485195, 4485197, 4485199, 4485200,
  4485201, 4485202, 4485203, 4485196
];

const ALL_VALID_IDS = [...VALID_HSR_IDS, ...VALID_JPN_IDS];

async function removeDuplicateUnits() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('='.repeat(80));
    console.log('FINDING INVALID/DUPLICATE UNITS');
    console.log('='.repeat(80));

    // Find all units
    const allUnits = await Unit.find({});
    console.log(`\nTotal units in database: ${allUnits.length}`);

    // Find invalid units (not in our valid list)
    const invalidUnits = allUnits.filter(unit => !ALL_VALID_IDS.includes(unit.ruPropertyId));
    
    console.log(`\nInvalid/Old units found: ${invalidUnits.length}`);
    
    if (invalidUnits.length > 0) {
      console.log('\nUnits to be deleted:');
      invalidUnits.forEach(unit => {
        console.log(`  - ${unit.name} (RU ID: ${unit.ruPropertyId})`);
      });

      console.log('\n='.repeat(80));
      console.log('DELETING INVALID UNITS');
      console.log('='.repeat(80));

      const invalidIds = invalidUnits.map(u => u.ruPropertyId);
      const result = await Unit.deleteMany({ ruPropertyId: { $in: invalidIds } });
      
      console.log(`\n✅ Deleted ${result.deletedCount} invalid units`);

      // Update building unit counts
      const hsrBuilding = await Building.findOne({ slug: 'hodo-stays-hsr-layout' });
      const jpnBuilding = await Building.findOne({ slug: 'hodo-stays-jp-nagar' });

      if (hsrBuilding) {
        const hsrUnitCount = await Unit.countDocuments({ buildingId: hsrBuilding._id });
        await Building.findByIdAndUpdate(hsrBuilding._id, { totalUnits: hsrUnitCount });
        console.log(`✅ Updated HSR building unit count to ${hsrUnitCount}`);
      }

      if (jpnBuilding) {
        const jpnUnitCount = await Unit.countDocuments({ buildingId: jpnBuilding._id });
        await Building.findByIdAndUpdate(jpnBuilding._id, { totalUnits: jpnUnitCount });
        console.log(`✅ Updated JP Nagar building unit count to ${jpnUnitCount}`);
      }
    } else {
      console.log('\n✅ No invalid units found. Database is clean!');
    }

    console.log('\n='.repeat(80));
    console.log('FINAL STATUS');
    console.log('='.repeat(80));

    const hsrUnits = await Unit.countDocuments({ ruPropertyId: { $in: VALID_HSR_IDS } });
    const jpnUnits = await Unit.countDocuments({ ruPropertyId: { $in: VALID_JPN_IDS } });
    
    console.log(`\nHSR Layout Units: ${hsrUnits} (Expected: 10)`);
    console.log(`JP Nagar Units: ${jpnUnits} (Expected: 9)`);
    console.log(`Total Valid Units: ${hsrUnits + jpnUnits} (Expected: 19)`);

    if (hsrUnits === 10 && jpnUnits === 9) {
      console.log('\n✅ Perfect! All units are correctly synced.');
    } else {
      console.log('\n⚠️  Unit count mismatch. Please check the data.');
    }

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
  removeDuplicateUnits()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = removeDuplicateUnits;
