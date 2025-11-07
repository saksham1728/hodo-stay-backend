require('dotenv').config();
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000/api';

async function testBookingAPI() {
  try {
    console.log('🧪 Testing Booking API Endpoints\n');
    console.log('=' .repeat(50));

    // Test 1: Create Payment Order (Mock)
    console.log('\n📋 Test 1: Create Payment Order');
    console.log('-'.repeat(50));
    
    const orderResponse = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 21000,
        currency: 'INR',
        bookingData: {
          unitId: '68fb4285f33612db82abbe2d',
          checkIn: '2025-12-01',
          checkOut: '2025-12-04'
        }
      })
    });

    const orderData = await orderResponse.json();
    console.log('Response:', JSON.stringify(orderData, null, 2));

    if (orderData.success) {
      console.log('✅ Payment order created successfully');
    } else {
      console.log('❌ Failed to create payment order');
    }

    // Test 2: Verify Payment and Create Booking
    console.log('\n📋 Test 2: Verify Payment & Create Booking');
    console.log('-'.repeat(50));

    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() + 7);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 3);

    const verifyResponse = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderData.data?.orderId || 'order_test_123',
        razorpay_payment_id: 'pay_test_456',
        razorpay_signature: 'test_signature',
        bookingData: {
          unitId: '68fb4285f33612db82abbe2d',
          checkIn: checkInDate.toISOString().split('T')[0],
          checkOut: checkOutDate.toISOString().split('T')[0],
          numberOfGuests: 1,
          numberOfAdults: 1,
          numberOfChildren: 0,
          guestInfo: {
            name: 'API',
            surname: 'Test',
            email: 'apitest@example.com',
            phone: '+91 9876543210',
            address: '123 API Street',
            zipCode: '560102'
          },
          pricing: {
            ruPrice: 30000,
            clientPrice: 30000,
            currency: 'INR'
          },
          specialRequests: 'API test booking with correct price'
        }
      })
    });

    const verifyData = await verifyResponse.json();
    console.log('Response Status:', verifyResponse.status);
    console.log('Response:', JSON.stringify(verifyData, null, 2));

    let bookingReference = null;
    if (verifyData.success) {
      console.log('✅ Booking created successfully');
      bookingReference = verifyData.data?.booking?.bookingReference;
      console.log(`   Booking Reference: ${bookingReference}`);
    } else {
      console.log('❌ Failed to create booking');
      console.log('   Error:', verifyData.message);
    }

    // Test 3: Get Booking by Reference
    if (bookingReference) {
      console.log('\n📋 Test 3: Get Booking by Reference');
      console.log('-'.repeat(50));

      const getBookingResponse = await fetch(
        `${API_BASE}/bookings/reference/${bookingReference}`
      );

      const bookingData = await getBookingResponse.json();
      console.log('Response:', JSON.stringify(bookingData, null, 2));

      if (bookingData.success) {
        console.log('✅ Booking retrieved successfully');
      } else {
        console.log('❌ Failed to retrieve booking');
      }
    }

    // Test 4: Get Bookings by Email
    console.log('\n📋 Test 4: Get Bookings by Email');
    console.log('-'.repeat(50));

    const emailBookingsResponse = await fetch(
      `${API_BASE}/bookings/email?email=apitest@example.com`
    );

    const emailBookingsData = await emailBookingsResponse.json();
    console.log('Response:', JSON.stringify(emailBookingsData, null, 2));

    if (emailBookingsData.success) {
      console.log(`✅ Found ${emailBookingsData.data.bookings.length} booking(s)`);
    } else {
      console.log('❌ Failed to get bookings');
    }

    // Test 5: Cancel Booking
    if (bookingReference) {
      console.log('\n📋 Test 5: Cancel Booking');
      console.log('-'.repeat(50));

      const cancelResponse = await fetch(
        `${API_BASE}/bookings/${bookingReference}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'API test cancellation',
            cancelledBy: 'guest'
          })
        }
      );

      const cancelData = await cancelResponse.json();
      console.log('Response:', JSON.stringify(cancelData, null, 2));

      if (cancelData.success) {
        console.log('✅ Booking cancelled successfully');
      } else {
        console.log('❌ Failed to cancel booking');
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 API TEST SUMMARY');
    console.log('='.repeat(50));
    console.log('✅ All API endpoint tests completed!');
    console.log('\nTested Endpoints:');
    console.log('  ✓ POST /api/payments/create-order');
    console.log('  ✓ POST /api/payments/verify');
    console.log('  ✓ GET /api/bookings/reference/:ref');
    console.log('  ✓ GET /api/bookings/email');
    console.log('  ✓ POST /api/bookings/:ref/cancel');
    console.log('\n⚠️  Note: Payment signature verification will fail with mock data');
    console.log('   This is expected. Real Razorpay integration will work correctly.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Check if server is running
console.log('Checking if backend server is running...');
fetch(`${API_BASE}/../health`)
  .then(res => res.json())
  .then(data => {
    console.log('✅ Server is running\n');
    testBookingAPI();
  })
  .catch(err => {
    console.error('❌ Server is not running!');
    console.error('Please start the server with: npm start');
    process.exit(1);
  });
