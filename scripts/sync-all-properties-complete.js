const mongoose = require('mongoose');
const Building = require('../models/Building');
const Unit = require('../models/Unit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load the fetched property data
const propertyData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../property-details-complete.json'), 'utf8')
);

// Helper function to determine unit type from name
function determineUnitType(name) {
  if (name.includes('3BHK') || name.includes('3 BHK')) return '3BHK';
  if (name.includes('Penthouse') || name.includes('penthouse')) return '2BHK Penthouse';
  if (name.includes('2BHK') || name.includes('2 BHK')) return '2BHK';
  if (name.includes('1BHK') || name.includes('1 BHK')) return '1BHK';
  return '2BHK'; // Default
}

// Helper function to create slug
function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Create or get HSR building
async function getOrCreateHSRBuilding() {
  let building = await Building.findOne({ slug: 'hodo-stays-hsr-layout' });
  
  if (!building) {
    console.log('Creating HSR Layout building...');
    building = new Building({
      slug: 'hodo-stays-hsr-layout',
      name: 'Hodo Stays HSR Layout',
      title: 'Hodo Stays HSR Layout',
      subTitle: 'Modern Serviced Apartments in HSR Layout',
      description: 'Welcome to Hodo Stays, located in the heart of HSR Layout, Bangalore. Our modern apartments are perfect for both business and leisure travellers. Enjoy high-speed WiFi, TV, AC, a fully equipped kitchen, and daily housekeeping.',
      
      location: {
        addressLine1: '17th A Main Road',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        pincode: '560102',
        latitude: 12.9073812,
        longitude: 77.6417597
      },
      
      legacyLocation: {
        address: '17th A Main Road, HSR Layout',
        city: 'Bangalore',
        state: 'Karnataka',
        zipCode: '560102',
        country: 'India',
        coordinates: {
          latitude: 12.9073812,
          longitude: 77.6417597
        }
      },
      
      heroImage: 'https://dwe6atvmvow8k.cloudfront.net/ru/725503/3894210/638679719866879578.jpg',
      
      highlights: [
        'High-speed WiFi',
        'Fully equipped kitchen',
        'Daily housekeeping',
        'AC in all rooms',
        'Smart TV',
        'Lift access',
        'Ground-level parking',
        'Rooftop community area'
      ],
      
      amenities: [
        { id: 'wifi', name: 'High-Speed WiFi', icon: 'wifi', category: 'general' },
        { id: 'ac', name: 'Air Conditioning', icon: 'ac', category: 'general' },
        { id: 'tv', name: 'Smart TV', icon: 'tv', category: 'entertainment' },
        { id: 'kitchen', name: 'Fully Equipped Kitchen', icon: 'kitchen', category: 'kitchen' },
        { id: 'parking', name: 'Free Parking', icon: 'parking', category: 'parking' },
        { id: 'housekeeping', name: 'Daily Housekeeping', icon: 'cleaning', category: 'general' }
      ],
      
      seo: {
        metaTitle: 'Hodo Stays HSR Layout - Modern Serviced Apartments in Bangalore',
        metaDescription: 'Book your stay at Hodo Stays HSR Layout. Modern serviced apartments with high-speed WiFi, fully equipped kitchen, and daily housekeeping.',
        keywords: ['serviced apartments hsr layout', 'hodo stays', 'bangalore accommodation', 'hsr layout hotels']
      },
      
      isActive: true,
      totalUnits: 10
    });
    
    await building.save();
    console.log('✅ HSR Layout building created');
  } else {
    console.log('✅ HSR Layout building found:', building._id);
  }
  
  return building;
}

// Create or get JP Nagar building
async function getOrCreateJPNagarBuilding() {
  let building = await Building.findOne({ slug: 'hodo-stays-jp-nagar' });
  
  if (!building) {
    console.log('Creating JP Nagar building...');
    building = new Building({
      slug: 'hodo-stays-jp-nagar',
      name: 'Hodo Stays JP Nagar',
      title: 'Hodo Stays JP Nagar',
      subTitle: 'Modern Serviced Apartments in JP Nagar',
      description: 'Welcome to Hodo Stays JP Nagar, located in the heart of JP Nagar, Bangalore. Our modern apartments are perfect for both business and leisure travellers. Enjoy high-speed WiFi, TV, AC, a fully equipped kitchen, and daily housekeeping.',
      
      location: {
        addressLine1: 'JP Nagar',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        pincode: '560078',
        latitude: 12.9073812,
        longitude: 77.6417597
      },
      
      legacyLocation: {
        address: 'JP Nagar, Bangalore',
        city: 'Bangalore',
        state: 'Karnataka',
        zipCode: '560078',
        country: 'India',
        coordinates: {
          latitude: 12.9073812,
          longitude: 77.6417597
        }
      },
      
      heroImage: 'https://dwe6atvmvow8k.cloudfront.net/ru/725503/3894210/638679719866879578.jpg',
      
      highlights: [
        'High-speed WiFi',
        'Fully equipped kitchen',
        'Daily housekeeping',
        'AC in all rooms',
        'Smart TV',
        'Lift access',
        'Ground-level parking',
        'Rooftop community area'
      ],
      
      amenities: [
        { id: 'wifi', name: 'High-Speed WiFi', icon: 'wifi', category: 'general' },
        { id: 'ac', name: 'Air Conditioning', icon: 'ac', category: 'general' },
        { id: 'tv', name: 'Smart TV', icon: 'tv', category: 'entertainment' },
        { id: 'kitchen', name: 'Fully Equipped Kitchen', icon: 'kitchen', category: 'kitchen' },
        { id: 'parking', name: 'Free Parking', icon: 'parking', category: 'parking' },
        { id: 'housekeeping', name: 'Daily Housekeeping', icon: 'cleaning', category: 'general' }
      ],
      
      seo: {
        metaTitle: 'Hodo Stays JP Nagar - Modern Serviced Apartments in Bangalore',
        metaDescription: 'Book your stay at Hodo Stays JP Nagar. Modern serviced apartments with high-speed WiFi, fully equipped kitchen, and daily housekeeping.',
        keywords: ['serviced apartments jp nagar', 'hodo stays', 'bangalore accommodation', 'jp nagar hotels']
      },
      
      isActive: true,
      totalUnits: 9
    });
    
    await building.save();
    console.log('✅ JP Nagar building created');
  } else {
    console.log('✅ JP Nagar building found:', building._id);
  }
  
  return building;
}

// Sync unit to MongoDB
async function syncUnit(propertyData, buildingId, buildingName) {
  const ruPropertyId = parseInt(propertyData.propertyId);
  
  // Check if unit already exists
  let unit = await Unit.findOne({ ruPropertyId });
  
  const unitType = determineUnitType(propertyData.name);
  const unitTypeSlug = createSlug(unitType);
  
  const unitData = {
    ruPropertyId,
    ruOwnerID: parseInt(propertyData.ownerId),
    buildingId,
    name: propertyData.name,
    description: propertyData.description || '',
    unitType,
    unitTypeSlug,
    space: parseInt(propertyData.space) || 0,
    standardGuests: parseInt(propertyData.standardGuests) || 1,
    canSleepMax: parseInt(propertyData.canSleepMax) || 1,
    noOfUnits: parseInt(propertyData.noOfUnits) || 1,
    floor: parseInt(propertyData.floor) || 0,
    
    propertyType: {
      propertyTypeID: parseInt(propertyData.propertyTypeId) || 3,
      objectTypeID: parseInt(propertyData.objectTypeId) || 3
    },
    
    pricing: {
      deposit: parseFloat(propertyData.pricing?.deposit) || 0,
      securityDeposit: parseFloat(propertyData.pricing?.securityDeposit) || 0
    },
    
    checkInOut: {
      checkInFrom: propertyData.checkInOut?.checkInFrom || '14:00',
      checkInTo: propertyData.checkInOut?.checkInTo || '23:00',
      checkOutUntil: propertyData.checkInOut?.checkOutUntil || '11:00'
    },
    
    images: propertyData.images.map(img => ({
      imageTypeID: parseInt(img.imageTypeId),
      imageReferenceID: parseInt(img.imageReferenceId),
      url: img.url,
      isPrimary: img.isPrimary
    })),
    
    amenities: propertyData.amenities.map(amenity => ({
      amenityID: parseInt(amenity.amenityId),
      count: amenity.count
    })),
    
    compositionRooms: propertyData.compositionRooms.map(room => ({
      compositionRoomID: parseInt(room.compositionRoomId),
      count: 1
    })),
    
    isActive: propertyData.isActive !== false,
    isArchived: false,
    lastSyncedAt: new Date(),
    ruLastMod: propertyData.lastMod ? new Date(propertyData.lastMod) : new Date()
  };
  
  if (unit) {
    // Update existing unit
    Object.assign(unit, unitData);
    await unit.save();
    console.log(`  ✅ Updated: ${propertyData.name} (${propertyData.images.length} images)`);
  } else {
    // Create new unit
    unit = new Unit(unitData);
    await unit.save();
    console.log(`  ✅ Created: ${propertyData.name} (${propertyData.images.length} images)`);
  }
  
  return unit;
}

// Main execution
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('='.repeat(80));
    console.log('STEP 1: CREATE/GET BUILDINGS');
    console.log('='.repeat(80));
    
    const hsrBuilding = await getOrCreateHSRBuilding();
    const jpnBuilding = await getOrCreateJPNagarBuilding();
    
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: SYNC HSR LAYOUT UNITS');
    console.log('='.repeat(80));
    
    for (const property of propertyData.hsrProperties) {
      await syncUnit(property, hsrBuilding._id, 'HSR Layout');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: SYNC JP NAGAR UNITS');
    console.log('='.repeat(80));
    
    for (const property of propertyData.jpnProperties) {
      await syncUnit(property, jpnBuilding._id, 'JP Nagar');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SYNC COMPLETE');
    console.log('='.repeat(80));
    
    // Summary
    const hsrUnits = await Unit.countDocuments({ buildingId: hsrBuilding._id });
    const jpnUnits = await Unit.countDocuments({ buildingId: jpnBuilding._id });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`  HSR Layout Building: ${hsrUnits} units`);
    console.log(`  JP Nagar Building: ${jpnUnits} units`);
    console.log(`  Total Units: ${hsrUnits + jpnUnits}`);
    
    // Update building unit counts
    await Building.findByIdAndUpdate(hsrBuilding._id, { totalUnits: hsrUnits });
    await Building.findByIdAndUpdate(jpnBuilding._id, { totalUnits: jpnUnits });
    
    console.log('\n✅ All properties synced successfully!');

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
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = main;
