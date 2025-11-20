require('dotenv').config();
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

async function listAllProperties() {
    try {
        console.log('🔍 Fetching all properties from Rentals United...\n');
        console.log('Using credentials:');
        console.log('Username:', process.env.RU_USERNAME);
        console.log('Password:', process.env.RU_PASSWORD ? '***' + process.env.RU_PASSWORD.slice(-3) : 'NOT SET');
        console.log('');

        // Location ID 0 typically returns all properties
        const locationId = 0;
        const xmlResponse = await ruClient.pullListProp(locationId, false);
        
        console.log('📥 Raw XML Response:');
        console.log('='.repeat(80));
        console.log(xmlResponse);
        console.log('='.repeat(80));
        console.log('');

        // Parse the XML response
        const parsed = xmlParser.parse(xmlResponse);
        console.log('📊 Parsed Response:');
        console.log(JSON.stringify(parsed, null, 2));
        console.log('');

        // Extract properties
        let properties = [];
        if (parsed.Pull_ListProp_RS && parsed.Pull_ListProp_RS.Properties) {
            const propsData = parsed.Pull_ListProp_RS.Properties.Property;
            properties = Array.isArray(propsData) ? propsData : [propsData];
        }

        console.log(`\n✅ Found ${properties.length} properties:\n`);
        console.log('='.repeat(80));
        
        properties.forEach((prop, index) => {
            console.log(`\n${index + 1}. Property ID: ${prop.ID || prop['@_ID']}`);
            console.log(`   Name: ${prop.Name || 'N/A'}`);
            console.log(`   Owner ID: ${prop.OwnerID || 'N/A'}`);
            console.log(`   Last Modified: ${prop.LastMod || 'N/A'}`);
            console.log(`   Detailed Location ID: ${prop.DetailedLocationID || 'N/A'}`);
            console.log(`   IATA Code: ${prop.IATA || 'N/A'}`);
        });
        
        console.log('\n' + '='.repeat(80));
        console.log(`\n📋 Total Properties: ${properties.length}`);
        
        return properties;

    } catch (error) {
        console.error('❌ Error fetching properties:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    }
}

// Run the script
listAllProperties()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
