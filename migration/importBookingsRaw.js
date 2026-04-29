/**
 * Import bookings using raw SQL to bypass Supabase client cache
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const transformedDir = path.join(__dirname, 'data', 'transformed');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function importBookingsRaw() {
  console.log('📦 Importing bookings using raw SQL...\n');
  
  try {
    // Read transformed bookings
    const filePath = path.join(transformedDir, 'bookings.json');
    const bookings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`Found ${bookings.length} bookings to import`);
    
    // First, delete existing bookings
    console.log('\n🧹 Cleaning existing bookings...');
    try {
      const { error: deleteError } = await supabase
        .from('ho_bookings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (deleteError) {
        console.log('⚠️  Could not clean existing bookings:', deleteError.message);
      } else {
        console.log('✅ Existing bookings cleaned');
      }
    } catch (e) {
      console.log('⚠️  Skipping cleanup');
    }
    
    // Import in smaller batches
    const batchSize = 10;
    let imported = 0;
    let failed = 0;
    const errors = [];
    
    for (let i = 0; i < bookings.length; i += batchSize) {
      const batch = bookings.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(bookings.length / batchSize);
      
      try {
        // Use upsert with onConflict to handle duplicates
        const { data, error } = await supabase
          .from('ho_bookings')
          .upsert(batch, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })
          .select('id');
        
        if (error) {
          console.error(`❌ Batch ${batchNum}/${totalBatches} failed:`, error.message);
          failed += batch.length;
          errors.push({ batch: batchNum, error: error.message, count: batch.length });
        } else {
          imported += data.length;
          process.stdout.write(`\r✅ Progress: ${batchNum}/${totalBatches} batches (${imported}/${bookings.length} bookings)`);
        }
      } catch (error) {
        console.error(`\n❌ Batch ${batchNum}/${totalBatches} exception:`, error.message);
        failed += batch.length;
        errors.push({ batch: batchNum, error: error.message, count: batch.length });
      }
    }
    
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Imported: ${imported}`);
    console.log(`❌ Failed:   ${failed}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(e => {
        console.log(`   Batch ${e.batch}: ${e.error} (${e.count} records)`);
      });
    }
    
    console.log('='.repeat(60));
    
    if (imported === bookings.length) {
      console.log('\n🎉 All bookings imported successfully!');
    } else if (imported > 0) {
      console.log(`\n⚠️  Partial import: ${imported}/${bookings.length} bookings imported`);
    }
    
    return { imported, failed, errors };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  importBookingsRaw()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { importBookingsRaw };
