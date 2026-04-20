/**
 * Import transformed data to PostgreSQL/Supabase
 * Run: node migration/importData.js
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { getSupabaseClient } = require('../db/supabaseClient');

const TRANSFORMED_DIR = path.join(__dirname, 'transformed-data');

async function importCollection(tableName, filename, batchSize = 100) {
  console.log(`\n📥 Importing ${filename} to ${tableName}...`);
  
  const filepath = path.join(TRANSFORMED_DIR, filename);
  const data = JSON.parse(await fs.readFile(filepath, 'utf8'));
  console.log(`   Found ${data.length} records`);
  
  if (data.length === 0) {
    console.log(`   ⚠️  No data to import`);
    return 0;
  }
  
  const supabase = getSupabaseClient();
  let imported = 0;
  let errors = 0;
  
  // Import in batches
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      const { error } = await supabase
        .from(tableName)
        .insert(batch);
      
      if (error) {
        console.error(`   ❌ Batch ${i}-${i + batch.length} failed:`, error.message);
        errors += batch.length;
      } else {
        imported += batch.length;
        console.log(`   ✅ Imported ${imported}/${data.length}`);
      }
    } catch (err) {
      console.error(`   ❌ Batch error:`, err.message);
      errors += batch.length;
    }
  }
  
  console.log(`   📊 Success: ${imported}, Errors: ${errors}`);
  return imported;
}

async function importData() {
  try {
    console.log('🚀 Starting PostgreSQL data import...\n');
    console.log('⚠️  Make sure you have run transformData.js first!\n');
    
    // Import in correct order (respecting foreign keys)
    const counts = {
      buildings: await importCollection('ho_buildings', 'buildings.json'),
      units: await importCollection('ho_units', 'units.json'),
      users: await importCollection('ho_users', 'users.json'),
      coupons: await importCollection('ho_coupons', 'coupons.json'),
      bookings: await importCollection('ho_bookings', 'bookings.json'),
      propertyDailyCache: await importCollection('ho_property_daily_cache', 'property_daily_cache.json', 500)
    };
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log('Records imported:');
    Object.entries(counts).forEach(([collection, count]) => {
      console.log(`   ${collection}: ${count}`);
    });
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

importData();
