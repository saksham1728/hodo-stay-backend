const mongoose = require('mongoose');
const PropertyDailyCache = require('../models/PropertyDailyCache');
const Unit = require('../models/Unit');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

// Load environment variables from the correct path
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ruClient = require('../utils/ruClient');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function clearAndSyncCache() {
  try {
    // Verify credentials are loaded
    console.log('🔑 Checking RU API credentials...');
    if (!process.env.RU_ACCESS_KEY || !process.env.RU_SECRET_KEY) {
      console.error('❌ RU_ACCESS_KEY or RU_SECRET_KEY not found in environment variables');
      console.log('RU_ACCESS_KEY:', process.env.RU_ACCESS_KEY ? 'SET' : 'NOT SET');
      console.log('RU_SECRET_KEY:', process.env.RU_SECRET_KEY ? 'SET' : 'NOT SET');
      process.exit(1);
    }
    console.log('✅ RU API credentials loaded');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Step 1: Delete all existing cache
    console.log('\n🗑️  Deleting all existing cache...');
    const deleteResult = await PropertyDailyCache.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} cache entries`);

    // Step 2: Get all active units
    console.log('\n📋 Fetching all active units...');
    const units = await Unit.find({ isActive: true }).select('ruPropertyId unitNumber building');
    console.log(`✅ Found ${units.length} active units`);

    if (units.length === 0) {
      console.log('⚠️  No active units found. Exiting...');
      process.exit(0);
    }

    // Step 3: Sync pricing for next 180 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 180);

    console.log(`\n🔄 Syncing pricing from ${formatDate(today)} to ${formatDate(endDate)}`);
    console.log(`📅 Total days: 180\n`);

    let totalCached = 0;
    let totalErrors = 0;

    for (const unit of units) {
      console.log(`\n🏠 Processing Unit: ${unit.unitNumber} (RU ID: ${unit.ruPropertyId})`);
      
      let unitCached = 0;
      let unitErrors = 0;

      // Process in batches of 30 days to avoid overwhelming the API
      for (let batchStart = 0; batchStart < 180; batchStart += 30) {
        const batchDateFrom = new Date(today);
        batchDateFrom.setDate(batchDateFrom.getDate() + batchStart);
        
        const batchDateTo = new Date(today);
        batchDateTo.setDate(batchDateTo.getDate() + Math.min(batchStart + 30, 180));

        try {
          console.log(`  📅 Batch: ${formatDate(batchDateFrom)} to ${formatDate(batchDateTo)}`);
          
          const xmlResponse = await ruClient.pullListPropertyPrices(
            unit.ruPropertyId,
            formatDate(batchDateFrom),
            formatDate(batchDateTo),
            0
          );

          // Parse XML response
          const parsed = xmlParser.parse(xmlResponse);
          
          if (parsed.Pull_ListPropertyPrices_RS?.Prices?.Season) {
            const seasons = Array.isArray(parsed.Pull_ListPropertyPrices_RS.Prices.Season) 
              ? parsed.Pull_ListPropertyPrices_RS.Prices.Season 
              : [parsed.Pull_ListPropertyPrices_RS.Prices.Season];

            for (const season of seasons) {
              try {
                // Season has DateFrom and DateTo as attributes, and Price as child
                const dateFrom = season['@_DateFrom'] || season.DateFrom;
                const price = parseFloat(season.Price || 0);
                
                if (!dateFrom) {
                  console.error(`    ❌ No DateFrom found in season:`, season);
                  unitErrors++;
                  continue;
                }
                
                const date = new Date(dateFrom);
                date.setHours(0, 0, 0, 0);
                
                if (isNaN(date.getTime())) {
                  console.error(`    ❌ Invalid date: ${dateFrom}`);
                  unitErrors++;
                  continue;
                }
                
                await PropertyDailyCache.findOneAndUpdate(
                  {
                    ruPropertyId: unit.ruPropertyId,
                    date: date
                  },
                  {
                    ruPropertyId: unit.ruPropertyId,
                    unitId: unit._id,
                    date: date,
                    pricePerNight: price,
                    currency: 'INR',
                    isAvailable: true,
                    lastSynced: new Date()
                  },
                  { upsert: true, new: true }
                );
                unitCached++;
              } catch (err) {
                console.error(`    ❌ Error saving season: ${err.message}`);
                unitErrors++;
              }
            }
            console.log(`    ✅ Cached ${unitCached} days so far`);
          } else {
            console.log(`    ⚠️  No pricing data returned`);
          }

          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`    ❌ Error fetching batch: ${error.message}`);
          unitErrors++;
        }
      }

      console.log(`  📊 Unit Summary: ${unitCached} cached, ${unitErrors} errors`);
      totalCached += unitCached;
      totalErrors += unitErrors;

      // Delay between units
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Total units processed: ${units.length}`);
    console.log(`✅ Total days cached: ${totalCached}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);
  }
}

// Run the script
clearAndSyncCache();
