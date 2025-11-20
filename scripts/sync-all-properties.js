require('dotenv').config();
const mongoose = require('mongoose');
const ruClient = require('../utils/ruClient');
const Building = require('../models/Building');
const Unit = require('../models/Unit');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

// Fetch property details from RU
async function fetchPropertyDetails(propertyId) {
    try {
        console.log(`\n🔍 Fetching details for Property ID: ${propertyId}...`);
        const xmlResponse = await ruClient.pullListSpecProp(propertyId, 'INR');
        const parsed = xmlParser.parse(xmlResponse);
        
        if (parsed.Pull_ListSpecProp_RS && parsed.Pull_ListSpecProp_RS.Property) {
            return parsed.Pull_ListSpecProp_RS.Property;
        }
        return null;
    } catch (error) {
        console.error(`❌ Error fetching property ${propertyId}:`, error.message);
        return null;
    }
}

// Main sync function
async function syncAllProperties() {
    try {
        await connectDB();

        console.log('\n🔍 Step 1: Fetching all properties from Rentals United...\n');
        
        const xmlResponse = await ruClient.pullListProp(0, false);
        const parsed = xmlParser.parse(xmlResponse);
        
        let properties = [];
        if (parsed.Pull_ListProp_RS && parsed.Pull_ListProp_RS.Properties) {
            const propsData = parsed.Pull_ListProp_RS.Properties.Property;
            properties = Array.isArray(propsData) ? propsData : [propsData];
        }

        console.log(`✅ Found ${properties.length} properties\n`);
        console.log('='.repeat(80));

        // Display all properties
        properties.forEach((prop, index) => {
            console.log(`${index + 1}. ID: ${prop.ID} - ${prop.Name}`);
        });

        console.log('='.repeat(80));
        console.log('\n🔍 Step 2: Fetching detailed information for each property...\n');

        const detailedProperties = [];
        
        for (const prop of properties) {
            const details = await fetchPropertyDetails(prop.ID);
            if (details) {
                detailedProperties.push({
                    basicInfo: prop,
                    details: details
                });
                console.log(`✅ Fetched details for ${prop.ID}`);
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n✅ Successfully fetched details for ${detailedProperties.length} properties\n`);
        console.log('='.repeat(80));
        console.log('\n📊 DETAILED PROPERTY INFORMATION:\n');
        console.log('='.repeat(80));

        // Display detailed information
        detailedProperties.forEach((propData, index) => {
            const prop = propData.details;
            console.log(`\n${index + 1}. PROPERTY ID: ${propData.basicInfo.ID}`);
            console.log(`   Name: ${prop.Name || 'N/A'}`);
            console.log(`   Owner ID: ${prop.OwnerID || 'N/A'}`);
            console.log(`   Property Type ID: ${prop.PropertyTypeID || 'N/A'}`);
            console.log(`   Object Type ID: ${prop.ObjectTypeID || 'N/A'}`);
            console.log(`   Standard Guests: ${prop.StandardGuests || 'N/A'}`);
            console.log(`   Can Sleep Max: ${prop.CanSleepMax || 'N/A'}`);
            console.log(`   Space (sqm): ${prop.Space || 'N/A'}`);
            console.log(`   Floor: ${prop.Floor || 'N/A'}`);
            
            // Images
            if (prop.Images && prop.Images.Image) {
                const images = Array.isArray(prop.Images.Image) ? prop.Images.Image : [prop.Images.Image];
                console.log(`   Images: ${images.length} image(s)`);
            }
            
            // Composition Rooms
            if (prop.CompositionRooms && prop.CompositionRooms.CompositionRoom) {
                const rooms = Array.isArray(prop.CompositionRooms.CompositionRoom) 
                    ? prop.CompositionRooms.CompositionRoom 
                    : [prop.CompositionRooms.CompositionRoom];
                console.log(`   Rooms:`);
                rooms.forEach(room => {
                    console.log(`     - Room ID ${room['@_CompositionRoomID']}: ${room['@_Count']} unit(s)`);
                });
            }
            
            // Amenities
            if (prop.Amenities && prop.Amenities.Amenity) {
                const amenities = Array.isArray(prop.Amenities.Amenity) 
                    ? prop.Amenities.Amenity 
                    : [prop.Amenities.Amenity];
                console.log(`   Amenities: ${amenities.length} amenity/amenities`);
            }
            
            console.log(`   Description: ${prop.Description ? prop.Description.substring(0, 100) + '...' : 'N/A'}`);
        });

        console.log('\n' + '='.repeat(80));
        console.log('\n💾 Step 3: Saving to MongoDB...\n');

        // Find or create the building
        let building = await Building.findOne({ name: 'Hodo Stay HSR Layout' });
        
        if (!building) {
            building = await Building.create({
                name: 'Hodo Stay HSR Layout',
                description: 'Modern aparthotel in HSR Layout, Bangalore',
                location: {
                    address: 'HSR Layout',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    country: 'India'
                },
                isActive: true
            });
            console.log('✅ Created building: Hodo Stay HSR Layout');
        } else {
            console.log('✅ Found existing building: Hodo Stay HSR Layout');
        }

        // Save each property as a unit
        let savedCount = 0;
        let updatedCount = 0;

        for (const propData of detailedProperties) {
            const prop = propData.details;
            const basicInfo = propData.basicInfo;

            // Prepare images
            let images = [];
            if (prop.Images && prop.Images.Image) {
                const imageData = Array.isArray(prop.Images.Image) ? prop.Images.Image : [prop.Images.Image];
                images = imageData.map((img, idx) => ({
                    imageTypeID: img['@_ImageTypeID'] || 0,
                    imageReferenceID: img['@_ImageReferenceID'] || 0,
                    url: img.URL || img,
                    isPrimary: idx === 0
                }));
            }

            // Prepare amenities
            let amenities = [];
            if (prop.Amenities && prop.Amenities.Amenity) {
                const amenityData = Array.isArray(prop.Amenities.Amenity) 
                    ? prop.Amenities.Amenity 
                    : [prop.Amenities.Amenity];
                amenities = amenityData.map(a => ({
                    amenityID: a['@_ID'] || a,
                    count: a['@_Count'] || 1
                }));
            }

            // Prepare composition rooms
            let compositionRooms = [];
            if (prop.CompositionRooms && prop.CompositionRooms.CompositionRoom) {
                const roomData = Array.isArray(prop.CompositionRooms.CompositionRoom) 
                    ? prop.CompositionRooms.CompositionRoom 
                    : [prop.CompositionRooms.CompositionRoom];
                compositionRooms = roomData.map(r => ({
                    compositionRoomID: r['@_CompositionRoomID'] || 0,
                    count: r['@_Count'] || 1
                }));
            }

            const unitData = {
                ruPropertyId: basicInfo.ID,
                ruOwnerID: prop.OwnerID || basicInfo.OwnerID,
                buildingId: building._id,
                name: prop.Name || basicInfo.Name,
                description: prop.Description || '',
                unitType: 'To Be Classified', // User will classify later
                unitTypeSlug: 'to-be-classified',
                isRepresentative: false,
                space: prop.Space || 0,
                standardGuests: prop.StandardGuests || 1,
                canSleepMax: prop.CanSleepMax || 1,
                noOfUnits: prop.NoOfUnits || 1,
                floor: prop.Floor || 0,
                propertyType: {
                    propertyTypeID: prop.PropertyTypeID || 0,
                    objectTypeID: prop.ObjectTypeID || 0
                },
                pricing: {
                    deposit: prop.Deposit || 0,
                    securityDeposit: prop.SecurityDeposit || 0
                },
                checkInOut: {
                    checkInFrom: prop.CheckInFrom || '',
                    checkInTo: prop.CheckInTo || '',
                    checkOutUntil: prop.CheckOutUntil || '',
                    place: prop.CheckInOut?.Place || ''
                },
                images: images,
                amenities: amenities,
                compositionRooms: compositionRooms,
                isActive: true,
                isArchived: false,
                lastSyncedAt: new Date(),
                ruLastMod: basicInfo.LastMod ? new Date(basicInfo.LastMod) : new Date()
            };

            // Check if unit already exists
            const existingUnit = await Unit.findOne({ ruPropertyId: basicInfo.ID });
            
            if (existingUnit) {
                await Unit.findByIdAndUpdate(existingUnit._id, unitData, { new: true });
                console.log(`✅ Updated unit: ${basicInfo.ID} - ${prop.Name}`);
                updatedCount++;
            } else {
                try {
                    await Unit.create(unitData);
                    console.log(`✅ Created unit: ${basicInfo.ID} - ${prop.Name}`);
                    savedCount++;
                } catch (createError) {
                    if (createError.code === 11000) {
                        // Duplicate key error, try to update instead
                        const updated = await Unit.findOneAndUpdate(
                            { ruPropertyId: basicInfo.ID },
                            unitData,
                            { new: true, upsert: true }
                        );
                        console.log(`✅ Updated (via upsert) unit: ${basicInfo.ID} - ${prop.Name}`);
                        updatedCount++;
                    } else {
                        throw createError;
                    }
                }
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log(`\n✅ Sync completed!`);
        console.log(`   - New units created: ${savedCount}`);
        console.log(`   - Existing units updated: ${updatedCount}`);
        console.log(`   - Total units: ${savedCount + updatedCount}`);
        console.log('\n📝 Next step: Classify each unit as 2BHK, 3BHK, or 2BHK Penthouse\n');

    } catch (error) {
        console.error('❌ Error syncing properties:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    }
}

// Run the script
syncAllProperties()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
