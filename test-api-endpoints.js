const fetch = require('node-fetch');

async function testAPIEndpoints() {
  console.log('🌐 Testing API Endpoints (Server MongoDB Connection)\n');

  try {
    // Test 1: User Registration via API
    console.log('1️⃣ Testing User Registration API');
    console.log('='.repeat(40));

    const userData = {
      firstName: 'API',
      lastName: 'Test',
      email: `apitest${Date.now()}@example.com`,
      password: 'Test123456',
      phone: '9876543210'
    };

    const userResponse = await fetch('http://localhost:5000/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const userResult = await userResponse.json();
    console.log(`User Registration: ${userResponse.status} - ${userResult.success ? 'Success' : 'Failed'}`);

    if (userResult.success) {
      console.log('✅ User API works - MongoDB connection is fine');

      // Test 2: Property Sync via API
      console.log('\n2️⃣ Testing Property Sync via API');
      console.log('='.repeat(40));

      const propertiesResponse = await fetch('http://localhost:5000/api/properties?locationId=41982&forceSync=true');
      const propertiesResult = await propertiesResponse.json();

      console.log(`Properties Sync: ${propertiesResponse.status} - ${propertiesResult.success ? 'Success' : 'Failed'}`);

      if (propertiesResult.success) {
        console.log(`✅ Found ${propertiesResult.data.properties.length} properties`);
        if (propertiesResult.data.properties.length > 0) {
          console.log('Sample property:', propertiesResult.data.properties[0].name);
        }
      } else {
        console.log('❌ Property sync failed:', propertiesResult.message);
      }

      // Test 3: Check if properties are now cached
      console.log('\n3️⃣ Testing Cached Properties');
      console.log('='.repeat(40));

      const cachedResponse = await fetch('http://localhost:5000/api/properties?locationId=41982');
      const cachedResult = await cachedResponse.json();

      console.log(`Cached Properties: ${cachedResponse.status} - Found ${cachedResult.data?.properties?.length || 0} properties`);

      if (cachedResult.data?.properties?.length > 0) {
        console.log('✅ Properties are now cached in MongoDB!');
        console.log('Sample cached property:', cachedResult.data.properties[0].name);
      }

    } else {
      console.log('❌ User API failed:', userResult.message);
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testAPIEndpoints();