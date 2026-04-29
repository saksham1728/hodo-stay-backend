const mongoose = require('mongoose');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

// Load environment variables from the correct path
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Use environment variable to switch between MongoDB and Supabase
const USE_SUPABASE = process.env.DATABASE_TYPE === 'supabase';

// MongoDB models (legacy)
const MongoosePropertyDailyCache = require('../models/PropertyDailyCache');
const MongooseUnit = require('../models/Unit');

// Supabase repositories (new)
const propertyDailyCacheRepository = require('../repositories/propertyDailyCacheRepository');
const unitRepository = require('../repositories/unitRepository');

const ruClient = require('../utils/ruClient');

// Adapters to use either MongoDB or Supabase
const PropertyDailyCache = USE_SUPABASE ? propertyDailyCacheRepository : MongoosePropertyDailyCache;
const Unit = USE_SUPABASE ? unitRepository : MongooseUnit;

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

async function syncAvailability() {
  try {
    // Verify credentials are loaded
    console.log('🔑 Checking RU API credentials...');
    if (!process.env.RU_ACCESS_KEY || !process.env.RU_SECRET_KEY) {
      console.error('❌ RU_ACCESS_KEY or RU_SECRET_KEY not found in environment variables');
      process.exit(1);
    }
    console.log('✅ RU API credentials loaded');

    // Connect to database
    if (!USE_SUPABASE) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    } else {
      console.log('✅ Using Supabase');
    }

    // Get all active units
    console.log('\n📋 Fetching all active units...');
    let units;
    if (USE_SUPABASE) {
      units = await Unit.find({ isActive: true });
    } else {
      units = await Unit.find({ isActive: true }).select('ruPropertyId unitNumber building');
    }
    console.log(`✅ Found ${units.length} active units`);

    if (units.length === 0) {
      console.log('⚠️  No active units found. Exiting...');
      process.exit(0);
    }

    // Sync availability for next 180 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 180);

    console.log(`\n🔄 Syncing availability from ${formatDate(today)} to ${formatDate(endDate)}`);
    console.log(`📅 Total days: 180\n`);

    let totalUpdated = 0;
    let totalErrors = 0;

    for (const unit of units) {
      console.log(`\n🏠 Processing Unit: ${unit.unitNumber} (RU ID: ${unit.ruPropertyId})`);
      
      let unitUpdated = 0;
      let unitErrors = 0;

      // Process in batches of 30 days to avoid overwhelming the API
      for (let batchStart = 0; batchStart < 180; batchStart += 30) {
        const batchDateFrom = new Date(today);
        batchDateFrom.setDate(batchDateFrom.getDate() + batchStart);
        
        const batchDateTo = new Date(today);
        batchDateTo.setDate(batchDateTo.getDate() + Math.min(batchStart + 30, 180));

        try {
          console.log(`  📅 Batch: ${formatDate(batchDateFrom)} to ${formatDate(batchDateTo)}`);
          
          const xmlResponse = await ruClient.pullListPropertyAvailabilityCalendar(
            unit.ruPropertyId,
            formatDate(batchDateFrom),
            formatDate(batchDateTo)
          );

          // Parse XML response
          const parsed = xmlParser.parse(xmlResponse);
          
          if (parsed.Pull_ListPropertyAvailabilityCalendar_RS?.PropertyCalendar?.CalDay) {
            const calendarDays = Array.isArray(parsed.Pull_ListPropertyAvailabilityCalendar_RS.PropertyCalendar.CalDay) 
              ? parsed.Pull_ListPropertyAvailabilityCalendar_RS.PropertyCalendar.CalDay 
              : [parsed.Pull_ListPropertyAvailabilityCalendar_RS.PropertyCalendar.CalDay];

            for (const day of calendarDays) {
              try {
                // CalDay has Date as attribute
                const dateStr = day['@_Date'] || day.Date;
                const isBlocked = day.IsBlocked === 'true' || day.IsBlocked === true;
                const units = parseInt(day['@_Units'] || day.Units || 0);
                const reservations = parseInt(day['@_Reservations'] || day.Reservations || 0);
                
                if (!dateStr) {
                  console.error(`    ❌ No Date found in calendar day:`, day);
                  unitErrors++;
                  continue;
                }
                
                const date = new Date(dateStr);
                date.setHours(0, 0, 0, 0);
                
                if (isNaN(date.getTime())) {
                  console.error(`    ❌ Invalid date: ${dateStr}`);
                  unitErrors++;
                  continue;
                }
                
                // Unit is available if NOT blocked AND has available units (Units > Reservations)
                const isAvailable = !isBlocked && (units > reservations);
                
                // Update the cache entry
                let result;
                if (USE_SUPABASE) {
                  // For Supabase, find and update
                  const cacheEntries = await PropertyDailyCache.find({
                    ruPropertyId: unit.ruPropertyId,
                    date: { $gte: date, $lt: new Date(date.getTime() + 86400000) }
                  });
                  
                  if (cacheEntries.length > 0) {
                    await PropertyDailyCache.updateMany(
                      {
                        ruPropertyId: unit.ruPropertyId,
                        date: { $gte: date, $lt: new Date(date.getTime() + 86400000) }
                      },
                      {
                        $set: {
                          isAvailable: isAvailable,
                          lastSynced: new Date()
                        }
                      }
                    );
                    result = cacheEntries[0];
                    unitUpdated++;
                  } else {
                    console.error(`    ⚠️  No cache entry found for ${dateStr}`);
                  }
                } else {
                  result = await PropertyDailyCache.findOneAndUpdate(
                    {
                      ruPropertyId: unit.ruPropertyId,
                      date: date
                    },
                    {
                      isAvailable: isAvailable,
                      lastSynced: new Date()
                    },
                    { new: true }
                  );
                  
                  if (result) {
                    unitUpdated++;
                  } else {
                    console.error(`    ⚠️  No cache entry found for ${dateStr}`);
                  }
                }
              } catch (err) {
                console.error(`    ❌ Error updating availability: ${err.message}`);
                unitErrors++;
              }
            }
            console.log(`    ✅ Updated ${unitUpdated} days so far`);
          } else {
            console.log(`    ⚠️  No availability data returned`);
          }

          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`    ❌ Error fetching batch: ${error.message}`);
          unitErrors++;
        }
      }

      console.log(`  📊 Unit Summary: ${unitUpdated} updated, ${unitErrors} errors`);
      totalUpdated += unitUpdated;
      totalErrors += unitErrors;

      // Delay between units
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ AVAILABILITY SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Total units processed: ${units.length}`);
    console.log(`✅ Total days updated: ${totalUpdated}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    if (!USE_SUPABASE) {
      await mongoose.connection.close();
      console.log('\n👋 Database connection closed');
    }
    process.exit(0);
  }
}

// Run the script
syncAvailability();
