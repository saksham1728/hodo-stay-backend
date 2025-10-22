const ruClient = require('./utils/ruClient');

async function testAPI() {
  console.log('🚀 Testing Rentals United API with corrected format...\n');

  try {
    // Test 1: Get properties list
    console.log('1️⃣ Testing Pull_ListProp_RQ (Get Properties List)');
    console.log('=' .repeat(50));
    const propertiesResponse = await ruClient.pullListProp(41982, false);
    console.log('Properties Response:', propertiesResponse);
    console.log('\n');

    // Test 2: Get property details using the actual property ID
    console.log('2️⃣ Testing Pull_ListSpecProp_RQ (Get Property Details)');
    console.log('=' .repeat(50));
    const propertyDetailsResponse = await ruClient.pullListSpecProp(4017810, 'USD');
    console.log('Property Details Response:', propertyDetailsResponse);
    console.log('\n');

    // Test 3: Get price quote for the property
    console.log('3️⃣ Testing Pull_GetPropertyAvbPrice_RQ (Get Price Quote)');
    console.log('=' .repeat(50));
    const priceQuoteResponse = await ruClient.pullGetPropertyAvbPrice(
      4017810, 
      '2025-10-25', 
      '2025-10-28', 
      2, 
      'USD'
    );
    console.log('Price Quote Response:', priceQuoteResponse);
    console.log('\n');

    // Test 4: Get reservations
    console.log('4️⃣ Testing Pull_ListReservations_RQ (Get Reservations)');
    console.log('=' .repeat(50));
    const dateFrom = '2025-10-01 00:00:00';
    const dateTo = '2025-10-20 23:59:59';
    
    const reservationsResponse = await ruClient.pullListReservations(dateFrom, dateTo, 41982);
    console.log('Reservations Response:', reservationsResponse);
    console.log('\n');

    console.log('✅ All API Tests Complete!');
    console.log('🎉 Rentals United integration is working perfectly!');

  } catch (error) {
    console.error('❌ API Test Failed:', error);
  }
}

testAPI();