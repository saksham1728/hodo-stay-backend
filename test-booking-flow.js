require('dotenv').config();
const mongoose = require('mongoose');
const { Booking, Unit, Building } = require('./models');

async function testBookingFlow() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Get a unit to book
    console.log('📋 Step 1: Finding a unit to book...');
    const unit = await Unit.findOne({ isActive: true, isArchived: false });
    
    if (!unit) {
      console.log('❌ No units found! Please sync units first.');
      process.exit(1);
    }

    console.log(`✅ Found unit: ${unit.name}`);
    console.log(`   Unit ID: ${unit._id}`);
    console.log(`   RU Property ID: ${unit.ruPropertyId}`);
    console.log(`   Building ID: ${unit.buildingId}\n`);

    // Step 2: Create a test booking
    console.log('📋 Step 2: Creating test booking...');
    
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 7); // 7 days from now
    
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3); // 3 nights
    
    const nights = 3;
    const pricePerNight = 7000;
    const totalPrice = nights * pricePerNight;

    const bookingData = {
      unitId: unit._id,
      buildingId: unit.buildingId,
      ruPropertyId: unit.ruPropertyId,
      checkIn: checkIn,
      checkOut: checkOut,
      nights: nights,
      guestInfo: {
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        phone: '+91 9876543210',
        address: '123 Test Street',
        zipCode: '560102'
      },
      numberOfGuests: 2,
      numberOfAdults: 2,
      numberOfChildren: 0,
      pricing: {
        ruPrice: totalPrice,
        clientPrice: totalPrice,
        alreadyPaid: totalPrice,
        currency: 'INR'
      },
      payment: {
        paymentId: 'pay_test_' + Date.now(),
        orderId: 'order_test_' + Date.now(),
        signature: 'test_signature',
        status: 'completed',
        method: 'test',
        paidAt: new Date()
      },
      status: 'confirmed',
      specialRequests: 'This is a test booking'
    };

    const booking = new Booking(bookingData);
    await booking.save();

    console.log('✅ Booking created successfully!');
    console.log(`   Booking Reference: ${booking.bookingReference}`);
    console.log(`   Check-in: ${booking.checkIn.toDateString()}`);
    console.log(`   Check-out: ${booking.checkOut.toDateString()}`);
    console.log(`   Nights: ${booking.nights}`);
    console.log(`   Total: ₹${booking.pricing.clientPrice.toLocaleString()}\n`);

    // Step 3: Retrieve booking by reference
    console.log('📋 Step 3: Retrieving booking by reference...');
    const retrievedBooking = await Booking.findOne({ 
      bookingReference: booking.bookingReference 
    })
      .populate('unitId')
      .populate('buildingId');

    if (retrievedBooking) {
      console.log('✅ Booking retrieved successfully!');
      console.log(`   Guest: ${retrievedBooking.guestInfo.name} ${retrievedBooking.guestInfo.surname}`);
      console.log(`   Email: ${retrievedBooking.guestInfo.email}`);
      console.log(`   Unit: ${retrievedBooking.unitId?.name || 'N/A'}`);
      console.log(`   Building: ${retrievedBooking.buildingId?.name || 'N/A'}\n`);
    }

    // Step 4: Get bookings by email
    console.log('📋 Step 4: Getting bookings by email...');
    const emailBookings = await Booking.find({ 
      'guestInfo.email': 'test@example.com' 
    });
    
    console.log(`✅ Found ${emailBookings.length} booking(s) for test@example.com\n`);

    // Step 5: Test cancellation
    console.log('📋 Step 5: Testing booking cancellation...');
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: 'guest',
      reason: 'Test cancellation',
      refundAmount: 0,
      refundStatus: 'pending'
    };
    await booking.save();

    console.log('✅ Booking cancelled successfully!\n');

    // Summary
    console.log('=' .repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(50));
    console.log('✅ All booking flow tests passed!');
    console.log('\nTest Booking Details:');
    console.log(`   Reference: ${booking.bookingReference}`);
    console.log(`   Status: ${booking.status}`);
    console.log(`   Unit: ${unit.name}`);
    console.log(`   RU Property ID: ${unit.ruPropertyId}`);
    console.log('\nNext Steps:');
    console.log('1. Test payment verification endpoint');
    console.log('2. Test RU API reservation creation');
    console.log('3. Test frontend integration');
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await Booking.deleteOne({ _id: booking._id });
    console.log('✅ Test booking deleted\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testBookingFlow();
