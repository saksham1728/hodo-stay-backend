/**
 * Verify Tables Script
 * Checks if all required tables exist in Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verifyTables() {
  console.log('🔍 Verifying tables in Supabase...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const tables = [
    'ho_buildings',
    'ho_units',
    'ho_users',
    'ho_coupons',
    'ho_bookings',
    'ho_property_daily_cache'
  ];

  let allExist = true;

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Table ${table}: NOT FOUND (${error.message})`);
        allExist = false;
      } else {
        console.log(`✅ Table ${table}: EXISTS (${count || 0} records)`);
      }
    } catch (error) {
      console.log(`❌ Table ${table}: ERROR - ${error.message}`);
      allExist = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  if (allExist) {
    console.log('✨ All tables verified successfully!');
    console.log('🎉 Database setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Continue with code migration');
    console.log('   2. Update controllers to use Supabase');
    console.log('   3. Test API endpoints');
  } else {
    console.log('⚠️  Some tables are missing!');
    console.log('\n📝 Please create tables manually:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Copy contents of db/schema.sql');
    console.log('   3. Paste and run in SQL Editor');
  }
  console.log('='.repeat(60) + '\n');
}

verifyTables();
