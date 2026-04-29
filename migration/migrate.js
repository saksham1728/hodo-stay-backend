/**
 * Migration Orchestration Script
 * Coordinates export, transform, and import phases
 * Task 12.4: Create migration orchestration script
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { exportAllData } = require('./exportData');
const { transformAllData } = require('./transformData');
const { importAllData } = require('./importData');
require('dotenv').config();

const dataDir = path.join(__dirname, 'data');
const backupDir = path.join(__dirname, 'backups');

/**
 * Create backup of current data
 */
function createBackup() {
  console.log('\n💾 Creating backup...');
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Copy data directory to backup
    if (fs.existsSync(dataDir)) {
      fs.cpSync(dataDir, backupPath, { recursive: true });
      console.log(`✅ Backup created: ${backupPath}`);
      return backupPath;
    } else {
      console.log('⚠️  No existing data to backup');
      return null;
    }
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  }
}

/**
 * Verify environment variables
 */
function verifyEnvironment() {
  console.log('\n🔍 Verifying environment variables...');
  
  const required = [
    'MONGODB_URI',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY'
  ];
  
  const missing = [];
  
  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      // Mask sensitive values
      const value = process.env[varName];
      const masked = varName.includes('KEY') || varName.includes('URI')
        ? value.substring(0, 10) + '...'
        : value;
      console.log(`✅ ${varName}: ${masked}`);
    }
  }
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    throw new Error('Missing environment variables');
  }
  
  console.log('✅ All required environment variables present');
}

/**
 * Clean up old data
 */
function cleanupOldData() {
  console.log('\n🧹 Cleaning up old data...');
  
  try {
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length > 0) {
        console.log(`   Found ${jsonFiles.length} old files`);
        // Don't delete, just note them
        console.log('   Old files will be overwritten');
      }
    }
  } catch (error) {
    console.error('⚠️  Cleanup warning:', error.message);
  }
}

/**
 * Generate final migration report
 */
function generateFinalReport(results) {
  console.log('\n📝 Generating final migration report...');
  
  const report = {
    migrationDate: new Date().toISOString(),
    phases: {
      export: results.export,
      transform: results.transform,
      import: results.import
    },
    summary: {
      totalDocumentsExported: results.export?.totalDocuments || 0,
      totalDocumentsImported: results.import?.totalImported || 0,
      totalFailed: results.import?.totalFailed || 0,
      success: results.import?.totalFailed === 0
    },
    environment: {
      mongodbUri: process.env.MONGODB_URI.replace(/\/\/.*@/, '//***@'),
      supabaseUrl: process.env.SUPABASE_URL,
      nodeVersion: process.version
    }
  };
  
  const reportPath = path.join(__dirname, 'MIGRATION_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`✅ Report saved to: ${reportPath}`);
  
  return report;
}

/**
 * Print migration instructions
 */
function printInstructions() {
  console.log('\n' + '='.repeat(70));
  console.log('📋 MIGRATION INSTRUCTIONS');
  console.log('='.repeat(70));
  console.log('');
  console.log('This script will perform the following steps:');
  console.log('');
  console.log('1. ✅ Verify environment variables');
  console.log('2. 💾 Create backup of existing data (if any)');
  console.log('3. 📦 Export data from MongoDB');
  console.log('4. 🔄 Transform data to PostgreSQL format');
  console.log('5. 📥 Import data to Supabase/PostgreSQL');
  console.log('6. 🔍 Validate data integrity');
  console.log('7. 📝 Generate migration report');
  console.log('');
  console.log('⚠️  WARNING: This is a one-way migration!');
  console.log('   Make sure you have:');
  console.log('   - Backed up your MongoDB database');
  console.log('   - Tested in a staging environment');
  console.log('   - Reviewed the migration plan');
  console.log('');
  console.log('='.repeat(70));
}

/**
 * Prompt for confirmation
 */
function promptConfirmation() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question('\n❓ Do you want to proceed with the migration? (yes/no): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Main migration function
 */
async function runMigration(options = {}) {
  const {
    skipConfirmation = false,
    skipBackup = false,
    incrementalTest = false
  } = options;
  
  console.log('\n' + '🚀'.repeat(35));
  console.log('🚀  MONGODB TO POSTGRESQL MIGRATION');
  console.log('🚀'.repeat(35));
  
  const startTime = Date.now();
  const results = {};
  
  try {
    // Print instructions
    printInstructions();
    
    // Verify environment
    verifyEnvironment();
    
    // Prompt for confirmation (unless skipped)
    if (!skipConfirmation) {
      const confirmed = await promptConfirmation();
      if (!confirmed) {
        console.log('\n❌ Migration cancelled by user');
        process.exit(0);
      }
    }
    
    console.log('\n✅ Starting migration...');
    
    // Create backup
    if (!skipBackup) {
      results.backup = createBackup();
    }
    
    // Clean up old data
    cleanupOldData();
    
    // Phase 1: Export
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 1: EXPORT DATA FROM MONGODB');
    console.log('='.repeat(70));
    results.export = await exportAllData();
    
    // Phase 2: Transform
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 2: TRANSFORM DATA');
    console.log('='.repeat(70));
    results.transform = await transformAllData();
    
    // Phase 3: Import
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 3: IMPORT DATA TO POSTGRESQL');
    console.log('='.repeat(70));
    results.import = await importAllData();
    
    // Generate final report
    const finalReport = generateFinalReport(results);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Print final summary
    console.log('\n' + '='.repeat(70));
    console.log('🎉 MIGRATION COMPLETED!');
    console.log('='.repeat(70));
    console.log(`Total duration:           ${duration}s`);
    console.log(`Documents exported:       ${finalReport.summary.totalDocumentsExported}`);
    console.log(`Documents imported:       ${finalReport.summary.totalDocumentsImported}`);
    console.log(`Failed imports:           ${finalReport.summary.totalFailed}`);
    console.log(`Success:                  ${finalReport.summary.success ? '✅ YES' : '❌ NO'}`);
    console.log('='.repeat(70));
    
    if (finalReport.summary.success) {
      console.log('\n✅ Migration successful! Next steps:');
      console.log('   1. Review the migration report');
      console.log('   2. Test your application with PostgreSQL');
      console.log('   3. Update DATABASE_TYPE=supabase in .env');
      console.log('   4. Deploy to production');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review:');
      console.log('   - migration/data/import-report.json');
      console.log('   - migration/MIGRATION_REPORT.json');
    }
    
    return finalReport;
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nStack trace:', error.stack);
    
    console.log('\n🔄 Rollback options:');
    console.log('   1. Your MongoDB data is unchanged');
    console.log('   2. Backup is available at:', results.backup || 'N/A');
    console.log('   3. You can re-run the migration after fixing issues');
    
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    skipConfirmation: args.includes('--yes') || args.includes('-y'),
    skipBackup: args.includes('--no-backup'),
    incrementalTest: args.includes('--test')
  };
  
  runMigration(options)
    .then(() => {
      console.log('\n✅ Migration script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runMigration };
