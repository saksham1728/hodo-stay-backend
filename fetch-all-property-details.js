const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API Credentials
const USERNAME = 'hello@hodostays.com';
const PASSWORD = 'HodoStays@12';
const API_BASE_URL = 'https://rm.rentalsunited.com/api/Handler.ashx';

// All property IDs
const HSR_PROPERTY_IDS = [
  '3894210', '3894211', '3894213', '3894214', '3894215',
  '3894216', '3894217', '3894219', '3904648', '3905815'
];

const JPN_PROPERTY_IDS = [
  '4485194', '4485195', '4485197', '4485199', '4485200',
  '4485201', '4485202', '4485203', '4485196'
];

// Function to fetch property details
async function fetchPropertyDetails(propertyId) {
  const xmlRequest = `<Pull_ListSpecProp_RQ><Authentication><UserName>${USERNAME}</UserName><Password>${PASSWORD}</Password></Authentication><PropertyID>${propertyId}</PropertyID><Currency>INR</Currency></Pull_ListSpecProp_RQ>`;

  try {
    const response = await axios.post(API_BASE_URL, xmlRequest, {
      headers: {
        'User-Agent': 'Hodo-Stay-Backend/1.0',
        'content': 'application/xml',
        'accept': 'application/xml'
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching property ${propertyId}:`, error.message);
    throw error;
  }
}

// Function to parse XML property details to JSON
function parsePropertyXML(xmlString) {
  const property = {};

  // Basic info
  property.propertyId = xmlString.match(/<ID BuildingID="-1"[^>]*>(\d+)<\/ID>/)?.[1];
  property.puid = xmlString.match(/<PUID BuildingID="-1">([^<]+)<\/PUID>/)?.[1];
  property.name = xmlString.match(/<Name>([^<]+)<\/Name>/)?.[1];
  property.ownerId = xmlString.match(/<OwnerID>(\d+)<\/OwnerID>/)?.[1];
  property.detailedLocationId = xmlString.match(/<DetailedLocationID[^>]*>(\d+)<\/DetailedLocationID>/)?.[1];
  property.dateCreated = xmlString.match(/<DateCreated>([^<]+)<\/DateCreated>/)?.[1];
  property.lastMod = xmlString.match(/<LastMod[^>]*>([^<]+)<\/LastMod>/)?.[1];
  property.isActive = xmlString.match(/<LastMod[^>]*Active="([^"]+)"/)?.[1] === 'true';

  // Location
  property.location = {
    street: xmlString.match(/<Street>([^<]+)<\/Street>/)?.[1],
    zipCode: xmlString.match(/<ZipCode>([^<]+)<\/ZipCode>/)?.[1],
    latitude: xmlString.match(/<Latitude>([^<]+)<\/Latitude>/)?.[1],
    longitude: xmlString.match(/<Longitude>([^<]+)<\/Longitude>/)?.[1]
  };

  // Unit details
  property.space = xmlString.match(/<Space>(\d+)<\/Space>/)?.[1];
  property.standardGuests = xmlString.match(/<StandardGuests>(\d+)<\/StandardGuests>/)?.[1];
  property.canSleepMax = xmlString.match(/<CanSleepMax>(\d+)<\/CanSleepMax>/)?.[1];
  property.floor = xmlString.match(/<Floor>(\d+)<\/Floor>/)?.[1];
  property.numberOfFloors = xmlString.match(/<NumberOfFloors>(\d+)<\/NumberOfFloors>/)?.[1];
  property.noOfUnits = xmlString.match(/<NoOfUnits>(\d+)<\/NoOfUnits>/)?.[1];

  // Property type
  property.propertyTypeId = xmlString.match(/<PropertyTypeID>(\d+)<\/PropertyTypeID>/)?.[1];
  property.objectTypeId = xmlString.match(/<ObjectTypeID>(\d+)<\/ObjectTypeID>/)?.[1];

  // Check-in/out
  property.checkInOut = {
    checkInFrom: xmlString.match(/<CheckInFrom>([^<]+)<\/CheckInFrom>/)?.[1],
    checkInTo: xmlString.match(/<CheckInTo>([^<]+)<\/CheckInTo>/)?.[1],
    checkOutUntil: xmlString.match(/<CheckOutUntil>([^<]+)<\/CheckOutUntil>/)?.[1]
  };

  // Pricing
  property.pricing = {
    cleaningPrice: xmlString.match(/<CleaningPrice>([^<]+)<\/CleaningPrice>/)?.[1],
    deposit: xmlString.match(/<Deposit[^>]*>([^<]+)<\/Deposit>/)?.[1],
    securityDeposit: xmlString.match(/<SecurityDeposit[^>]*>([^<]+)<\/SecurityDeposit>/)?.[1]
  };

  // Contact
  property.contact = {
    email: xmlString.match(/<Email>([^<]+)<\/Email>/)?.[1],
    phone: xmlString.match(/<Phone>([^<]+)<\/Phone>/)?.[1]
  };

  // Extract ALL images
  property.images = [];
  const imageMatches = [...xmlString.matchAll(/<Image ImageTypeID="(\d+)" ImageReferenceID="(\d+)">([^<]+)<\/Image>/g)];
  imageMatches.forEach(match => {
    property.images.push({
      imageTypeId: match[1],
      imageReferenceId: match[2],
      url: match[3],
      isPrimary: match[1] === '1'
    });
  });

  // Extract image captions
  property.imageCaptions = [];
  const captionMatches = [...xmlString.matchAll(/<ImageCaption LanguageID="(\d+)" ImageReferenceID="(\d+)">([^<]+)<\/ImageCaption>/g)];
  captionMatches.forEach(match => {
    property.imageCaptions.push({
      languageId: match[1],
      imageReferenceId: match[2],
      caption: match[3]
    });
  });

  // Extract ALL amenities
  property.amenities = [];
  const amenityMatches = [...xmlString.matchAll(/<Amenity Count="(\d+)">(\d+)<\/Amenity>/g)];
  amenityMatches.forEach(match => {
    property.amenities.push({
      amenityId: match[2],
      count: parseInt(match[1])
    });
  });

  // Extract composition rooms
  property.compositionRooms = [];
  const roomMatches = [...xmlString.matchAll(/<CompositionRoomAmenities CompositionRoomID="(\d+)">/g)];
  roomMatches.forEach(match => {
    property.compositionRooms.push({
      compositionRoomId: match[1]
    });
  });

  // Extract descriptions
  const descMatch = xmlString.match(/<Text><!\[CDATA\[([^\]]+)\]\]><\/Text>/);
  property.description = descMatch ? descMatch[1].trim() : '';

  const accessMatch = xmlString.match(/<Access><!\[CDATA\[([^\]]+)\]\]><\/Access>/);
  property.accessDescription = accessMatch ? accessMatch[1].trim() : '';

  const interactionMatch = xmlString.match(/<Interaction><!\[CDATA\[([^\]]+)\]\]><\/Interaction>/);
  property.interactionDescription = interactionMatch ? interactionMatch[1].trim() : '';

  const spaceMatch = xmlString.match(/<Space><!\[CDATA\[([^\]]+)\]\]><\/Space>/);
  property.spaceDescription = spaceMatch ? spaceMatch[1].trim() : '';

  const houseRulesMatch = xmlString.match(/<HouseRules><!\[CDATA\[([^\]]+)\]\]><\/HouseRules>/);
  property.houseRules = houseRulesMatch ? houseRulesMatch[1].trim() : '';

  // Cancellation policy
  const cancelMatch = xmlString.match(/<CancellationPolicy ValidFrom="(\d+)" ValidTo="(\d+)">([^<]+)<\/CancellationPolicy>/);
  if (cancelMatch) {
    property.cancellationPolicy = {
      validFrom: cancelMatch[1],
      validTo: cancelMatch[2],
      percentage: cancelMatch[3]
    };
  }

  return property;
}

// Main execution
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('FETCHING ALL PROPERTY DETAILS FROM RENTALS UNITED API');
    console.log('='.repeat(80));

    const allProperties = {
      fetchedAt: new Date().toISOString(),
      currency: 'INR',
      hsrProperties: [],
      jpnProperties: []
    };

    // Fetch HSR properties
    console.log('\n📍 Fetching HSR Layout Properties...');
    for (const propertyId of HSR_PROPERTY_IDS) {
      console.log(`  Fetching property ${propertyId}...`);
      const xmlResponse = await fetchPropertyDetails(propertyId);
      const parsedProperty = parsePropertyXML(xmlResponse);
      allProperties.hsrProperties.push(parsedProperty);
      console.log(`  ✅ ${parsedProperty.name} - ${parsedProperty.images.length} images`);
    }

    // Fetch JPN properties
    console.log('\n📍 Fetching JP Nagar Properties...');
    for (const propertyId of JPN_PROPERTY_IDS) {
      console.log(`  Fetching property ${propertyId}...`);
      const xmlResponse = await fetchPropertyDetails(propertyId);
      const parsedProperty = parsePropertyXML(xmlResponse);
      allProperties.jpnProperties.push(parsedProperty);
      console.log(`  ✅ ${parsedProperty.name} - ${parsedProperty.images.length} images`);
    }

    // Save to JSON file
    const outputPath = path.join(__dirname, 'property-details-complete.json');
    fs.writeFileSync(outputPath, JSON.stringify(allProperties, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ SUCCESS - ALL PROPERTIES FETCHED');
    console.log('='.repeat(80));
    console.log(`\nTotal HSR Properties: ${allProperties.hsrProperties.length}`);
    console.log(`Total JPN Properties: ${allProperties.jpnProperties.length}`);
    console.log(`\nComplete parsed data saved to: ${outputPath}`);
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('\nHSR Layout Properties:');
    allProperties.hsrProperties.forEach((prop, i) => {
      console.log(`  ${i + 1}. ${prop.name}`);
      console.log(`     - Images: ${prop.images.length}`);
      console.log(`     - Amenities: ${prop.amenities.length}`);
      console.log(`     - Max Guests: ${prop.canSleepMax}`);
    });

    console.log('\nJP Nagar Properties:');
    allProperties.jpnProperties.forEach((prop, i) => {
      console.log(`  ${i + 1}. ${prop.name}`);
      console.log(`     - Images: ${prop.images.length}`);
      console.log(`     - Amenities: ${prop.amenities.length}`);
      console.log(`     - Max Guests: ${prop.canSleepMax}`);
    });

    console.log('\n✅ File ready to share with your manager!');

  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
