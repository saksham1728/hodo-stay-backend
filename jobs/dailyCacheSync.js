/**
 * Daily Property Cache Sync Job
 * Runs every day at 2 AM to refresh property availability and pricing cache
 */

const cron = require('node-cron');
const propertyCacheSync = require('../services/propertyCacheSync');

let lastSyncTime = null;
let lastSyncResult = null;

function startDailySyncJob() {
  // Run every day at 2 AM (0 2 * * *)
  const cronJob = cron.schedule('0 2 * * *', async () => {
    console.log('🕐 Starting scheduled property cache sync...');
    console.log(`   Current time: ${new Date().toISOString()}`);
    console.log(`   Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    const startTime = Date.now();
    
    try {
      // Sync all units
      const result = await propertyCacheSync.syncAllUnits();
      
      // Clean up old data
      await propertyCacheSync.cleanupOldData();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      lastSyncTime = new Date();
      lastSyncResult = {
        success: true,
        successCount: result.successCount,
        errorCount: result.errorCount,
        duration: duration
      };
      
      console.log(`✅ Scheduled sync completed in ${duration}s`);
      console.log(`   Synced: ${result.successCount} units, Failed: ${result.errorCount} units`);
      console.log(`   Next sync: Tomorrow at 2 AM`);
      
    } catch (error) {
      console.error('❌ Scheduled sync failed:', error);
      lastSyncTime = new Date();
      lastSyncResult = {
        success: false,
        error: error.message
      };
      // In production, send alert email/notification here
    }
  });

  console.log('📅 Daily cache sync job scheduled (runs at 2 AM daily)');
  console.log(`   Current server time: ${new Date().toISOString()}`);
  console.log(`   Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`   Next scheduled run: ${getNextCronRun()}`);
  
  // Return job info for status endpoint
  return {
    isRunning: () => cronJob.getStatus() === 'scheduled',
    getLastSync: () => lastSyncTime,
    getLastResult: () => lastSyncResult,
    getNextRun: () => getNextCronRun()
  };
}

function getNextCronRun() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(2, 0, 0, 0);
  
  // If 2 AM has passed today, schedule for tomorrow
  if (now.getHours() >= 2) {
    next.setDate(next.getDate() + 1);
  }
  
  return next.toISOString();
}

module.exports = { startDailySyncJob };
