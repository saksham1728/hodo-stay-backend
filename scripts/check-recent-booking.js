/**
 * Check recent booking and coupon usage
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initializeSupabase } = require('../db/supabaseClient');
const bookingRepository = require('../repositories/bookingRepository');
const couponUsageRepository = require('../repositories/couponUsageRepository');

async function checkRecentBooking() {
  try {
    console.log('🔍 Checking recent bookings and coupon usage...\n');

    // Initialize Supabase
    await initializeSupabase();
    console.log('✅ Supabase initialized\n');

    // Get most recent booking
    console.log('📋 Fetching most recent booking...');
    const bookings = await bookingRepository.find({}, { 
      sort: { createdAt: -1 }, 
      limit: 1 
    });

    if (bookings.length === 0) {
      console.log('❌ No bookings found');
      return;
    }

    const booking = bookings[0];
    console.log('✅ Most recent booking:');
    console.log(`   - Reference: ${booking.bookingReference}`);
    console.log(`   - ID: ${booking.id}`);
    console.log(`   - Guest: ${booking.guestInfo?.email}`);
    console.log(`   - Applied Coupon: ${booking.appliedCoupon || 'None'}`);
    console.log(`   - Coupon ID: ${booking.couponId || 'None'}`);
    console.log(`   - Created: ${new Date(booking.createdAt).toLocaleString()}`);
    console.log(`   - Pricing:`, JSON.stringify(booking.pricing, null, 2));

    // Check if coupon was applied
    if (booking.appliedCoupon) {
      console.log('\n📋 Checking coupon usage record...');
      const usage = await couponUsageRepository.findOne({ 
        bookingId: booking.id 
      });

      if (usage) {
        console.log('✅ Coupon usage record found:');
        console.log(`   - Coupon Code: ${usage.couponCode}`);
        console.log(`   - Original Price: ₹${usage.originalPrice}`);
        console.log(`   - Discount: ₹${usage.discountAmount}`);
        console.log(`   - Final Price: ₹${usage.finalPrice}`);
        console.log(`   - Applied At: ${new Date(usage.appliedAt).toLocaleString()}`);
      } else {
        console.log('❌ No coupon usage record found for this booking!');
        console.log('   This means the coupon tracking failed.');
      }
    } else {
      console.log('\nℹ️  No coupon was applied to this booking');
    }

    // Get all coupon usage records
    console.log('\n📋 All coupon usage records:');
    const allUsages = await couponUsageRepository.find({}, { 
      sort: { appliedAt: -1 } 
    });
    console.log(`   Total records: ${allUsages.length}`);
    allUsages.forEach((usage, index) => {
      console.log(`   ${index + 1}. ${usage.couponCode} - ${usage.userEmail} - ₹${usage.discountAmount} (${new Date(usage.appliedAt).toLocaleString()})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

checkRecentBooking();
