/**
 * Check coupon data to see usedBy array
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initializeSupabase } = require('../db/supabaseClient');
const couponRepository = require('../repositories/couponRepository');

async function checkCouponData() {
  try {
    console.log('🔍 Checking WELCOME10 coupon data...\n');

    // Initialize Supabase
    await initializeSupabase();
    console.log('✅ Supabase initialized\n');

    // Get WELCOME10 coupon
    const coupon = await couponRepository.findOne({ code: 'WELCOME10' });

    if (!coupon) {
      console.log('❌ WELCOME10 coupon not found');
      return;
    }

    console.log('✅ Coupon found:');
    console.log(`   - Code: ${coupon.code}`);
    console.log(`   - ID: ${coupon.id}`);
    console.log(`   - Usage Type: ${coupon.usageType}`);
    console.log(`   - Max Usage Per User: ${coupon.maxUsagePerUser}`);
    console.log(`   - Current Usage Count: ${coupon.currentUsageCount}`);
    console.log(`   - Used By Array:`, JSON.stringify(coupon.usedBy, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

checkCouponData();
