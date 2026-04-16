require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Unit = require('../models/Unit');
const PropertyDailyCache = require('../models/PropertyDailyCache');

/**
 * Verify that all webhook bookings have their dates marked unavailable in cache
 */
async function verifyWebhookBookings() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Fetch all bookings with ruStatus "Confirmed via webhook"
    console.log('📥 Fetching webhook bookings...');
    const webhookBookings = await Booking.find({ 
      ruStatus: 'Confirmed via webhook' 
    }).populate('unitId');

    console.log(`✅ Found ${webhookBookings.length} webhook bookings\n`);

    if (webhookBookings.length === 0) {
      console.log('ℹ️  No webhook bookings found. Create a test booking in Rentals United to verify.');
      process.exit(0);
    }

    console.log('=' .repeat(80));
    console.log('VERIFICATION REPORT');
    console.log('=' .repeat(80));

    let allCorrect = true;
    let totalDaysChecked = 0;
    let unavailableDays = 0;
    let availableDays = 0;

    for (const booking of webhookBookings) {
      console.log(`\n📋 Booking: ${booking.bookingReference}`);
      console.log(`   RU Reservation ID: ${booking.ruReservationId}`);
      console.log(`   Unit: ${booking.unitId?.name || 'Unknown'}`);
      console.log(`   Check-in: ${booking.checkIn.toISOString().split('T')[0]}`);
      console.log(`   Check-out: ${booking.checkOut.toISOString().split('T')[0]}`);
      console.log(`   Nights: ${booking.nights}`);
      console.log(`   Guest: ${booking.guestInfo.name} ${booking.guestInfo.surname}`);
      console.log(`   Source: ${booking.bookingSource}`);

      // Skip if unit is missing
      if (!booking.unitId) {
        console.log(`   ⚠️  SKIPPED: Unit not found (may have been deleted)`);
        continue;
      }

      // Check cache for each date in the booking range
      const cacheRecords = await PropertyDailyCache.find({
        unitId: booking.unitId._id,
        date: {
          $gte: booking.checkIn,
          $lt: booking.checkOut
        }
      }).sort({ date: 1 });

      console.log(`\n   📅 Cache Status:`);
      
      if (cacheRecords.length === 0) {
        console.log(`   ❌ NO CACHE RECORDS FOUND for these dates!`);
        allCorrect = false;
        continue;
      }

      let bookingCorrect = true;
      for (const cache of cacheRecords) {
        const dateStr = cache.date.toISOString().split('T')[0];
        const status = cache.isAvailable ? '❌ AVAILABLE' : '✅ UNAVAILABLE';
        console.log(`      ${dateStr}: ${status}`);
        
        totalDaysChecked++;
        if (cache.isAvailable) {
          availableDays++;
          bookingCorrect = false;
          allCorrect = false;
        } else {
          unavailableDays++;
        }
      }

      if (bookingCorrect) {
        console.log(`   ✅ All dates correctly marked as UNAVAILABLE`);
      } else {
        console.log(`   ❌ Some dates are still marked as AVAILABLE (ERROR!)`);
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total Bookings: ${webhookBookings.length}`);
    console.log(`Total Days Checked: ${totalDaysChecked}`);
    console.log(`✅ Correctly Unavailable: ${unavailableDays}`);
    console.log(`❌ Incorrectly Available: ${availableDays}`);
    
    if (allCorrect) {
      console.log('\n🎉 SUCCESS! All webhook bookings have their dates correctly marked as unavailable!');
    } else {
      console.log('\n⚠️  WARNING! Some dates are not properly marked as unavailable in cache.');
      console.log('   This may indicate an issue with the webhook processing.');
    }

    console.log('\n' + '=' .repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

verifyWebhookBookings();
