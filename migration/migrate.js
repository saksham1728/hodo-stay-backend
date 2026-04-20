/**
 * Complete Migration Runner
 * Run: node migration/migrate.js
 */

const { execSync } = require('child_process');

function runCommand(command, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${description}`);
  console.log('='.repeat(60));
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed`);
    return false;
  }
}

async function migrate() {
  console.log('\n🚀 STARTING COMPLETE MIGRATION\n');
  console.log('This will:');
  console.log('1. Export data from MongoDB');
  console.log('2. Transform data (ObjectId → UUID, camelCase → snake_case)');
  console.log('3. Import data to PostgreSQL/Supabase\n');
  
  console.log('⚠️  IMPORTANT:');
  console.log('- Make sure MongoDB is running and accessible');
  console.log('- Make sure Supabase credentials are in .env');
  console.log('- Make sure schema.sql has been executed in Supabase');
  console.log('- This will NOT delete MongoDB data (safe to run)\n');
  
  // Step 1: Export
  if (!runCommand('node migration/exportData.js', 'Step 1: Export from MongoDB')) {
    process.exit(1);
  }
  
  // Step 2: Transform
  if (!runCommand('node migration/transformData.js', 'Step 2: Transform data')) {
    process.exit(1);
  }
  
  // Step 3: Import
  if (!runCommand('node migration/importData.js', 'Step 3: Import to PostgreSQL')) {
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ MIGRATION COMPLETE!');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Verify data in Supabase dashboard');
  console.log('2. Set DATABASE_TYPE=supabase in .env');
  console.log('3. Restart your application');
  console.log('4. Test all functionality');
  console.log('5. Keep MongoDB running as backup for 30 days');
  console.log('='.repeat(60));
}

migrate();
