/**
 * Import only bookings - with fresh Supabase client
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const transformedDir = path.join(__dirname, 'data', 'transformed');

// Create fresh Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false
    }
  }
);

async function importBookings() {
  console.log('📦 Importing bookings to ho_bookings...\n');
  
  try {
    // Read transformed bookings
    const filePath = path.join(transformedDir, 'bookings.json');
    const bookings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`Found ${bookings.length} bookings to import`);
    
    // Import in batches
    const batchSize = 50;
    let imported = 0;
    let failed = 0;
    
    for (let i = 0; i < bookings.length; i += batchSize) {
      const batch = bookings.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(bookings.length / batchSize);
      
      try {
        const { data, error } = await supabase
          .from('ho_bookings')
          .insert(batch)
          .select('id');
        
        if (error) {
          console.error(`❌ Batch ${batchNum}/${totalBatches} failed:`, error.message);
          failed += batch.length;
        } else {
          imported += data.length;
          console.log(`✅ Batch ${batchNum}/${totalBatches}: ${data.length} bookings imported`);
        }
      } catch (error) {
        console.error(`❌ Batch ${batchNum}/${totalBatches} exception:`, error.message);
        failed += batch.length;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Imported: ${imported}`);
    console.log(`❌ Failed:   ${failed}`);
    console.log('='.repeat(60));
    
    if (imported === bookings.length) {
      console.log('\n🎉 All bookings imported successfully!');
    }
    
    return { imported, failed };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  importBookings()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { importBookings };
