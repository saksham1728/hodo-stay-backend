/**
 * Create PostgreSQL Schema in Supabase
 * Executes the schema.sql file to create all tables
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createSchema() {
  console.log('🚀 Creating PostgreSQL schema in Supabase...\n');
  console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
  
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema file loaded');
    console.log(`   File: ${schemaPath}`);
    console.log(`   Size: ${schema.length} characters\n`);
    
    // Execute schema using Supabase RPC
    // Note: Supabase doesn't support direct SQL execution via JS client
    // We need to use the REST API directly
    
    const { data, error } = await supabase.rpc('exec_sql', { sql: schema });
    
    if (error) {
      console.error('❌ Schema creation failed:', error.message);
      console.log('\n📋 Manual Steps Required:');
      console.log('1. Go to: https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Click "SQL Editor" in the left sidebar');
      console.log('4. Click "New Query"');
      console.log('5. Copy and paste the content of: db/schema.sql');
      console.log('6. Click "Run"');
      console.log('\nAfter creating the schema, run: node migration/migrate.js --yes');
      return false;
    }
    
    console.log('✅ Schema created successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Manual Steps Required:');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Click "SQL Editor" in the left sidebar');
    console.log('4. Click "New Query"');
    console.log('5. Copy and paste the content of: db/schema.sql');
    console.log('6. Click "Run"');
    console.log('\nAfter creating the schema, run: node migration/migrate.js --yes');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  createSchema()
    .then((success) => {
      if (success) {
        console.log('\n✅ Ready to run migration!');
        console.log('   Run: node migration/migrate.js --yes');
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { createSchema };
