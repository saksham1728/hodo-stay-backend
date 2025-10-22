const ruClient = require('./utils/ruClient');

async function testPricing() {
  console.log('🧪 Testing pricing API with correct guest count...\n');

  try {
    // Test with 1 guest (property max is 1)
    console.log('Testing Pull_GetPropertyAvbPrice_RQ with 1 guest');
    console.log('=' .repeat(50));
    
    const priceQuoteResponse = await ruClient.pullGetPropertyAvbPrice(
      4017810, 
      '2025-10-25', 
      '2025-10-28', 
      1, // Changed to 1 guest
      'USD'
    );
    console.log('Price Quote Response:', priceQuoteResponse);

  } catch (error) {
    console.error('❌ Pricing Test Failed:', error);
  }
}

testPricing();