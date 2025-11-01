require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('../models/Building');
const Unit = require('../models/Unit');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

async function syncUnits(buildingId, locationId = 41982) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Verify building exists
    const building = await Building.findById(buildingId);
    if (!building) {
      throw new Error('Building not found');
    }
    
    console.log(`📦 Syncing units for: ${building.name}`);
    console.log(`📍 Location ID: ${locationId}`);
    
    // Step 1: Get list of properties in location
    console.log('🔄 Fetching property list from RU API...');
    const listXml = await ruClient.pullListProp(locationId, false);
    const listResponse = xmlParser.parse(listXml);
    
    if (listResponse.error) {
      throw new Error(`API Error: ${listResponse.error}`);
    }
    
    const apiProperties = listResponse?.Pull_ListProp_RS?.Properties?.Property || [];
    const propertiesArray = Array.isArray(apiProperties) ? apiProperties : [apiProperties];
    
    console.log(`📋 Found ${propertiesArray.length} properties`);
    
    let savedCount = 0;
    
    // Step 2: Get detailed info for each property and save
    for (const apiProperty of propertiesArray) {
      const propertyId = parseInt(apiProperty.ID);
      
      try {
        console.log(`\n🔄 Fetching details for property ${propertyId}...`);
        
        const detailXml = await ruClient.pullListSpecProp(propertyId);
        const detailResponse = xmlParser.parse(detailXml);
        const propertyDetail = detailResponse?.Pull_ListSpecProp_RS?.Property;
        
        if (!propertyDetail) {
          console.log(`  ⚠ No details found, skipping`);
          continue;
        }
        
        const unitData = {
          ruPropertyId: propertyId,
          ruOwnerID: parseInt(apiProperty.OwnerID) || 0,
          buildingId: buildingId,
          name: propertyDetail.Name || apiProperty.Name || `Unit ${propertyId}`,
          description: propertyDetail.Description || '',
          space: parseFloat(propertyDetail.Space) || 0,
          standardGuests: parseInt(propertyDetail.StandardGuests) || 1,
          canSleepMax: parseInt(propertyDetail.CanSleepMax) || 1,
          noOfUnits: parseInt(propertyDetail.NoOfUnits) || 1,
          floor: parseInt(propertyDetail.Floor) || 0,
          propertyType: {
            propertyTypeID: parseInt(propertyDetail.PropertyTypeID) || 0,
            objectTypeID: parseInt(propertyDetail.ObjectTypeID) || 0
          },
          pricing: {
            deposit: parseFloat(propertyDetail.Deposit) || 0,
            securityDeposit: parseFloat(propertyDetail.SecurityDeposit) || 0
          },
          checkInOut: {
            checkInFrom: propertyDetail.CheckInFrom || '',
            checkInTo: propertyDetail.CheckInTo || '',
            checkOutUntil: propertyDetail.CheckOutUntil || '',
            place: propertyDetail.CheckInOutPlace || ''
          },
          images: [],
          amenities: [],
          compositionRooms: [],
          lastSyncedAt: new Date(),
          ruLastMod: apiProperty.LastMod ? new Date(apiProperty.LastMod) : new Date()
        };
        
        // Parse images if available
        if (propertyDetail.Images?.Image) {
          const images = Array.isArray(propertyDetail.Images.Image) 
            ? propertyDetail.Images.Image 
            : [propertyDetail.Images.Image];
          
          unitData.images = images.map((img, index) => ({
            imageTypeID: parseInt(img['@_ImageTypeID']) || 0,
            imageReferenceID: parseInt(img['@_ImageReferenceID']) || 0,
            url: typeof img === 'string' ? img : (img['#text'] || img),
            isPrimary: index === 0
          }));
        }
        
        // Parse amenities if available
        if (propertyDetail.Amenities?.Amenity) {
          const amenities = Array.isArray(propertyDetail.Amenities.Amenity)
            ? propertyDetail.Amenities.Amenity
            : [propertyDetail.Amenities.Amenity];
          
          unitData.amenities = amenities.map(amenity => ({
            amenityID: parseInt(amenity['@_ID']) || 0,
            count: parseInt(amenity['@_Count']) || 1
          }));
        }
        
        // Parse composition rooms if available
        if (propertyDetail.CompositionRooms?.CompositionRoom) {
          const rooms = Array.isArray(propertyDetail.CompositionRooms.CompositionRoom)
            ? propertyDetail.CompositionRooms.CompositionRoom
            : [propertyDetail.CompositionRooms.CompositionRoom];
          
          unitData.compositionRooms = rooms.map(room => ({
            compositionRoomID: parseInt(room['@_ID']) || 0,
            count: parseInt(room['@_Count']) || 1
          }));
        }
        
        // Upsert unit
        const unit = await Unit.findOneAndUpdate(
          { ruPropertyId: unitData.ruPropertyId },
          unitData,
          { upsert: true, new: true }
        );
        
        console.log(`  ✓ Saved: ${unit.name}`);
        savedCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.log(`  ⚠ Error: ${error.message}`);
      }
    }
    
    // Update building's total units count
    const totalUnits = await Unit.countDocuments({ buildingId, isActive: true, isArchived: false });
    await Building.findByIdAndUpdate(buildingId, { totalUnits });
    
    console.log(`\n✅ Successfully synced ${savedCount} units`);
    console.log(`📊 Total active units in building: ${totalUnits}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get building ID from command line argument
const buildingId = process.argv[2];
const locationId = process.argv[3] || 41982;

if (!buildingId) {
  console.error('❌ Please provide building ID as argument');
  console.log('Usage: node scripts/sync-units.js <buildingId> [locationId]');
  process.exit(1);
}

syncUnits(buildingId, locationId);
