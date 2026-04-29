/**
 * Reset coupon usage for testing
 * Clears the usedBy array and resets usage count
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initializeSupabase, getSupabaseClient } = require('../db/supabaseClient');

async function resetCouponUsage() {
  try {
    console.log('🔄 Resetting WELCOME10 coupon usage...\n');

    // Initialize Supabase
    await initializeSupabase();
    console.log('✅ Supabase initialized\n');

    // Update the coupon to reset usage
    const { data, error } = await getSupabaseClient()
      .from('ho_coupons')
      .update({
        used_by: [],
        current_usage_count: 0
      })
      .eq('code', 'WELCOME10')
      .select();

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Coupon usage reset successfully!');
    console.log('   - Used By: []');
    console.log('   - Current Usage Count: 0');
    console.log('\n🎉 You can now use the WELCOME10 coupon again!');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

resetCouponUsage();
