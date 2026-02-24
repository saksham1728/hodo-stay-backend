const PropertyDailyCache = require('../models/PropertyDailyCache');
const Unit = require('../models/Unit');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

class PropertyCacheSyncService {
  /**
   * Sync availability and pricing for all active units
   * Fetches next 180 days of data from Rentals United
   */
  async syncAllUnits() {
    console.log('🔄 Starting property cache sync...');
    const startTime = Date.now();
    
    try {
      // Get all active units with RU property IDs
      const units = await Unit.find({ 
        isActive: true,
        ruPropertyId: { $exists: true, $ne: null }
      });

      console.log(`📋 Found ${units.length} units to sync`);

      let successCount = 0;
      let errorCount = 0;

      for (const unit of units) {
        try {
          await this.syncUnit(unit);
          successCount++;
          console.log(`✅ Synced unit ${unit._id} (${unit.ruPropertyId})`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to sync unit ${unit._id} (${unit.name}) - RU Property ID: ${unit.ruPropertyId}`);
          console.error(`   Error: ${error.message}`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✨ Sync completed in ${duration}s`);
      console.log(`   Success: ${successCount}, Errors: ${errorCount}`);

      return { successCount, errorCount, duration };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync a single unit's availability and pricing
   */
  async syncUnit(unit) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 180);

    const dateFrom = this.formatDate(today);
    const dateTo = this.formatDate(futureDate);

    console.log(`   Fetching data for ${unit.ruPropertyId} (${dateFrom} to ${dateTo})`);

    // Step 1: Fetch availability calendar
    const availabilityData = await this.fetchAvailability(unit.ruPropertyId, dateFrom, dateTo);
    
    // Step 2: Fetch pricing function (returns function that gets price for any date)
    const getPriceForDate = await this.fetchPricing(unit.ruPropertyId, dateFrom, dateTo);
    
    // If no pricing data, skip this unit
    if (!getPriceForDate) {
      console.log(`   ⚠️  Skipping unit - no pricing data available in RU`);
      return;
    }
    
    // Step 3: Merge and upsert to database with seasonal pricing
    await this.upsertCacheData(unit, availabilityData, getPriceForDate);
  }

  /**
   * Fetch availability calendar from RU
   */
  async fetchAvailability(propertyId, dateFrom, dateTo) {
    const response = await ruClient.pullListPropertyAvailabilityCalendar(propertyId, dateFrom, dateTo);
    const parsed = xmlParser.parse(response);
    
    const calendar = parsed.Pull_ListPropertyAvailabilityCalendar_RS?.PropertyCalendar;
    if (!calendar) {
      throw new Error('No calendar data returned from RU');
    }

    const calDays = calendar.CalDay;
    if (!calDays) {
      throw new Error('No CalDay data in calendar');
    }
    
    const daysArray = Array.isArray(calDays) ? calDays : [calDays];

    return daysArray
      .map(day => {
        const dateStr = day['@_Date'] || day.Date;
        if (!dateStr) {
          console.warn('⚠️  Missing date in CalDay:', day);
          return null;
        }
        
        return {
          date: dateStr,
          isAvailable: !(day.IsBlocked === 'true' || day.IsBlocked === true) && 
                       parseInt(day['@_Units'] || day.Units || 0) > 0
        };
      })
      .filter(day => day !== null);
  }

  /**
   * Fetch pricing from RU and map to each day based on seasons
   */
  async fetchPricing(propertyId, dateFrom, dateTo) {
    const response = await ruClient.pullListPropertyPrices(propertyId, dateFrom, dateTo, 0);
    const parsed = xmlParser.parse(response);
    
    const prices = parsed.Pull_ListPropertyPrices_RS?.Prices;
    if (!prices) {
      console.log(`   ⚠️  No pricing data structure returned from RU`);
      return null;
    }

    // Extract all seasons with date ranges and prices
    const seasons = prices.Season;
    if (!seasons) {
      console.log(`   ⚠️  No Season data in pricing response (property may not have pricing configured)`);
      return null;
    }
    
    const seasonsArray = Array.isArray(seasons) ? seasons : [seasons];
    
    // Parse seasons into usable format
    const seasonPricing = seasonsArray
      .map(season => {
        const price = parseFloat(season.Price || season['#text'] || 0);
        const dateFromStr = season['@_DateFrom'] || season.DateFrom;
        const dateToStr = season['@_DateTo'] || season.DateTo;
        
        if (isNaN(price) || !dateFromStr || !dateToStr) {
          console.warn(`   ⚠️  Invalid season data:`, season);
          return null;
        }
        
        return {
          dateFrom: new Date(dateFromStr + 'T00:00:00.000Z'),
          dateTo: new Date(dateToStr + 'T00:00:00.000Z'),
          price: price
        };
      })
      .filter(s => s !== null);
    
    if (seasonPricing.length === 0) {
      console.log(`   ⚠️  No valid seasons found`);
      return null;
    }

    console.log(`   💰 Found ${seasonPricing.length} seasons with pricing`);
    
    // Return function that gets price for a specific date
    return (date) => {
      // Find which season this date falls into
      for (const season of seasonPricing) {
        if (date >= season.dateFrom && date <= season.dateTo) {
          return season.price;
        }
      }
      
      // If no season found, use minimum price as fallback
      const minPrice = Math.min(...seasonPricing.map(s => s.price));
      console.warn(`   ⚠️  No season found for ${date.toISOString().split('T')[0]}, using min price: ${minPrice}`);
      return minPrice;
    };
  }

  /**
   * Upsert cache data to database with seasonal pricing per day
   */
  async upsertCacheData(unit, availabilityData, getPriceForDate) {
    const bulkOps = availabilityData
      .map(day => {
        // Parse date string (YYYY-MM-DD format)
        const dateObj = new Date(day.date + 'T00:00:00.000Z');
        
        if (isNaN(dateObj.getTime())) {
          console.warn(`⚠️  Invalid date: ${day.date}`);
          return null;
        }
        
        // Get the correct seasonal price for this specific date
        const priceForThisDay = getPriceForDate(dateObj);
        
        return {
          updateOne: {
            filter: { 
              unitId: unit._id, 
              date: dateObj
            },
            update: {
              $set: {
                ruPropertyId: unit.ruPropertyId,
                isAvailable: day.isAvailable,
                pricePerNight: priceForThisDay,
                lastSynced: new Date()
              }
            },
            upsert: true
          }
        };
      })
      .filter(op => op !== null);

    if (bulkOps.length > 0) {
      const result = await PropertyDailyCache.bulkWrite(bulkOps);
      console.log(`   📝 Upserted ${result.upsertedCount + result.modifiedCount} records with seasonal pricing`);
    }
  }

  /**
   * Format date as YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Clean up old cache data (older than 180 days)
   */
  async cleanupOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);

    const result = await PropertyDailyCache.deleteMany({
      date: { $lt: cutoffDate }
    });

    console.log(`🗑️  Cleaned up ${result.deletedCount} old records`);
    return result.deletedCount;
  }
}

module.exports = new PropertyCacheSyncService();
