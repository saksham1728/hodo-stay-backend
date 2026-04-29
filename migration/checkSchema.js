/**
 * Check what schema Supabase client is seeing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking Supabase schema cache...\n');
  
  try {
    // Get a real building and unit ID
    const { data: buildings } = await supabase.from('ho_buildings').select('id').limit(1);
    const { data: units } = await supabase.from('ho_units').select('id').limit(1);
    
    if (!buildings || !units || buildings.length === 0 || units.length === 0) {
      console.error('❌ No buildings or units found. Import those first!');
      return;
    }
    
    const testBooking = {
      id: '00000000-0000-0000-0000-000000000001',
      booking_reference: 'TEST-' + 'X'.repeat(95), // 100 chars total
      building_id: buildings[0].id,
      unit_id: units[0].id,
      ru_property_id: 12345,
      check_in: '2024-01-01',
      check_out: '2024-01-02',
      nights: 1,
      guest_info: { name: 'Test' },
      number_of_guests: 1,
      pricing: { total: 1000 }
    };
    
    console.log(`Testing with ${testBooking.booking_reference.length} character booking_reference...`);
    
    const { data, error } = await supabase
      .from('ho_bookings')
      .insert(testBooking)
      .select();
    
    if (error) {
      console.error('❌ Insert failed:', error.message);
      
      if (error.message.includes('too long')) {
        console.log('\n💡 This confirms the schema cache issue!');
        console.log('   The API still thinks booking_reference is VARCHAR(50)');
        console.log('\n🔧 Solution: Wait 5-10 minutes for cache to expire');
      }
    } else {
      console.log('✅ Insert successful!');
      console.log('   Schema cache has been refreshed!');
      
      // Clean up test record
      await supabase
        .from('ho_bookings')
        .delete()
        .eq('id', testBooking.id);
      
      console.log('\n🎉 Ready to import all bookings!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
