require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('../models/Building');
const Unit = require('../models/Unit');

async function updateBuildingPhotos() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get both buildings
    const hsrBuilding = await Building.findOne({ name: 'Hodo Stays HSR Layout' });
    const jpBuilding = await Building.findOne({ name: 'Hodo Stays JP Nagar' });

    if (!hsrBuilding || !jpBuilding) {
      console.log('❌ Buildings not found');
      return;
    }

    console.log('\n📸 Fetching unit images...');

    // Get units from each building
    const hsrUnits = await Unit.find({ buildingId: hsrBuilding._id }).limit(5);
    const jpUnits = await Unit.find({ buildingId: jpBuilding._id }).limit(5);

    // Extract unique images from HSR units
    const hsrImages = [];
    hsrUnits.forEach(unit => {
      if (unit.images && unit.images.length > 0) {
        unit.images.forEach(img => {
          if (!hsrImages.includes(img) && hsrImages.length < 8) {
            hsrImages.push(img);
          }
        });
      }
    });

    // Extract unique images from JP Nagar units
    const jpImages = [];
    jpUnits.forEach(unit => {
      if (unit.images && unit.images.length > 0) {
        unit.images.forEach(img => {
          if (!jpImages.includes(img) && jpImages.length < 8) {
            jpImages.push(img);
          }
        });
      }
    });

    console.log(`\n📊 Found ${hsrImages.length} images for HSR Layout`);
    console.log(`📊 Found ${jpImages.length} images for JP Nagar`);

    // Update HSR Layout building
    if (hsrImages.length > 0) {
      hsrBuilding.images = hsrImages;
      await hsrBuilding.save();
      console.log(`✅ Updated HSR Layout with ${hsrImages.length} images`);
    }

    // Update JP Nagar building
    if (jpImages.length > 0) {
      jpBuilding.images = jpImages;
      await jpBuilding.save();
      console.log(`✅ Updated JP Nagar with ${jpImages.length} images`);
    }

    console.log('\n✅ Building photos updated successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

updateBuildingPhotos();
