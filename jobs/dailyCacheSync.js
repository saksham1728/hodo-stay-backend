/**
 * Daily Property Cache Sync Job
 * Runs every day at 2 AM to refresh property availability and pricing cache
 */

const cron = require('node-cron');
const propertyCacheSync = require('../services/propertyCacheSync');

function startDailySyncJob() {
  // Run every day at 2 AM (0 2 * * *)
  cron.schedule('0 2 * * *', async () => {
    console.log('🕐 Starting scheduled property cache sync...');
    const startTime = Date.now();
    
    try {
      // Sync all units
      const result = await propertyCacheSync.syncAllUnits();
      
      // Clean up old data
      await propertyCacheSync.cleanupOldData();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Scheduled sync completed in ${duration}s`);
      console.log(`   Synced: ${result.successCount} units, Failed: ${result.errorCount} units`);
      
    } catch (error) {
      console.error('❌ Scheduled sync failed:', error);
      // In production, send alert email/notification here
    }
  });

  console.log('📅 Daily cache sync job scheduled (runs at 2 AM daily)');
}

module.exports = { startDailySyncJob };
