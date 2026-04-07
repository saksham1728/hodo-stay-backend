/**
 * Database Setup Script
 * 
 * This script creates all necessary tables in Supabase/PostgreSQL
 * Run this once to set up the database schema
 * 
 * Usage: node db/setup-database.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('./supabaseClient');

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Schema file loaded successfully');
    console.log('📊 Creating tables with "ho_" prefix...\n');

    // Get Supabase client
    const supabase = getSupabaseClient();

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Extract table/function name for logging
      const match = statement.match(/CREATE\s+(TABLE|INDEX|TRIGGER|FUNCTION|OR REPLACE FUNCTION)\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
      const objectType = match ? match[1] : 'STATEMENT';
      const objectName = match ? match[2] : `statement ${i + 1}`;

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct execution if RPC fails
          console.log(`⚠️  RPC failed for ${objectName}, trying direct execution...`);
          throw error;
        }

        console.log(`✅ Created ${objectType}: ${objectName}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error creating ${objectName}:`, error.message);
        errorCount++;
        
        // Continue with other statements even if one fails
        if (error.message.includes('already exists')) {
          console.log(`   ℹ️  ${objectName} already exists, skipping...`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Database setup completed!`);
    console.log(`   Success: ${successCount} statements`);
    console.log(`   Errors: ${errorCount} statements`);
    console.log('='.repeat(60) + '\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');
    await verifyTables(supabase);

  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    console.error('\n💡 Manual Setup Instructions:');
    console.error('   1. Go to your Supabase project dashboard');
    console.error('   2. Navigate to SQL Editor');
    console.error('   3. Copy and paste the contents of db/schema.sql');
    console.error('   4. Click "Run" to execute the schema\n');
    process.exit(1);
  }
}

async function verifyTables(supabase) {
  const tables = [
    'ho_buildings',
    'ho_units',
    'ho_users',
    'ho_coupons',
    'ho_bookings',
    'ho_property_daily_cache'
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Table ${table}: NOT FOUND`);
      } else {
        console.log(`✅ Table ${table}: EXISTS (${count || 0} records)`);
      }
    } catch (error) {
      console.log(`❌ Table ${table}: ERROR - ${error.message}`);
    }
  }

  console.log('\n✨ Verification complete!\n');
}

// Run setup
setupDatabase();
