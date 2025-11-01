require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('../models/Building');

async function addBuilding() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Create the building
    const building = new Building({
      name: 'Modern HSR Layout Building',
      description: 'Modern apartments in HSR Layout, Bangalore',
      location: {
        address: 'HSR Layout',
        city: 'Bangalore',
        state: 'Karnataka',
        zipCode: '560102',
        country: 'India'
      },
      images: [],
      amenities: ['WiFi', 'Parking', 'Security', 'Elevator'],
      totalUnits: 0,
      isActive: true
    });
    
    await building.save();
    
    console.log('✅ Building created successfully!');
    console.log('Building ID:', building._id.toString());
    console.log('Building Name:', building.name);
    console.log('\nUse this Building ID to sync units from RU API');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addBuilding();
