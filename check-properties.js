require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkProperties() {
  try {
    console.log('🔍 Checking properties in Supabase...\n');

    // Get all units
    const { data: units, error } = await supabase
      .from('ho_units')
      .select('id, ru_property_id, name')
      .order('ru_property_id');

    if (error) {
      console.error('❌ Error fetching units:', error);
      return;
    }

    console.log(`📊 Total units in database: ${units.length}\n`);
    console.log('Synced Properties:');
    console.log('==================');
    units.forEach(u => {
      console.log(`${u.ru_property_id} - ${u.name}`);
    });

    // Check for the specific property IDs from the webhook
    console.log('\n🔍 Checking specific PropertyIDs from webhooks:');
    console.log('================================================');
    
    const propertyIds = [3894210, 4485201, 4485203];
    
    for (const propId of propertyIds) {
      const unit = units.find(u => u.ru_property_id === propId);
      if (unit) {
        console.log(`✅ ${propId} - FOUND: ${unit.name}`);
      } else {
        console.log(`❌ ${propId} - NOT FOUND in database`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkProperties();
