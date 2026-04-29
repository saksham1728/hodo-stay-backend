/**
 * Verify schema and clean existing data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function verifyAndClean() {
  console.log('🔍 Verifying schema and cleaning data...\n');
  
  try {
    // Check existing bookings count
    const { count, error: countError } = await supabase
      .from('ho_bookings')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting bookings:', countError.message);
    } else {
      console.log(`📊 Existing bookings: ${count}`);
      
      if (count > 0) {
        console.log('🧹 Deleting existing bookings...');
        const { error: deleteError } = await supabase
          .from('ho_bookings')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        
        if (deleteError) {
          console.error('❌ Delete failed:', deleteError.message);
        } else {
          console.log('✅ All bookings deleted');
        }
      }
    }
    
    console.log('\n📋 Please run this SQL in Supabase to reload schema cache:');
    console.log('');
    console.log('NOTIFY pgrst, \'reload schema\';');
    console.log('');
    console.log('Then run: node migration/importBookings.js');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyAndClean();
