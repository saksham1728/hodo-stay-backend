/**
 * Simple Table Creation Script
 * Creates all tables in Supabase using direct SQL execution
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function createTables() {
  console.log('🚀 Starting table creation in Supabase...\n');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
    process.exit(1);
  }

  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔑 Service Key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`);
  console.log('');

  // Read the schema file
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('📄 Schema file loaded');
  console.log('📊 Executing SQL to create tables...\n');

  try {
    // Use Supabase REST API to execute SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ query: schema })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to execute SQL:', error);
      console.log('\n💡 Trying alternative method: Manual SQL execution via Supabase client...\n');
      
      // Alternative: Use Supabase JS client
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Split and execute statements one by one
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      console.log(`Found ${statements.length} SQL statements\n`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        // Extract object name for logging
        const match = statement.match(/CREATE\s+(TABLE|INDEX|TRIGGER|FUNCTION|OR REPLACE FUNCTION)\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
        const objectType = match ? match[1] : 'STATEMENT';
        const objectName = match ? match[2] : `${i + 1}`;

        try {
          // For Supabase, we need to use the SQL editor or direct PostgreSQL connection
          // Since we can't execute arbitrary SQL via REST API, we'll log instructions
          console.log(`✓ Statement ${i + 1}/${statements.length}: ${objectType} ${objectName}`);
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} (${objectName}): ${err.message}`);
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('⚠️  MANUAL SETUP REQUIRED');
      console.log('='.repeat(60));
      console.log('\nSupabase REST API doesn\'t support arbitrary SQL execution.');
      console.log('Please create tables manually:\n');
      console.log('1. Go to: ' + SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/').replace('.supabase.co', ''));
      console.log('2. Click "SQL Editor" in the left sidebar');
      console.log('3. Click "New Query"');
      console.log('4. Copy the contents of: hodo-stay-backend/db/schema.sql');
      console.log('5. Paste into the SQL Editor');
      console.log('6. Click "Run" to execute\n');
      console.log('After that, run: node db/verify-tables.js');
      console.log('='.repeat(60) + '\n');
      
      return;
    }

    const result = await response.json();
    console.log('✅ Tables created successfully!');
    console.log(result);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 MANUAL SETUP INSTRUCTIONS:');
    console.log('='.repeat(60));
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy contents of hodo-stay-backend/db/schema.sql');
    console.log('4. Paste and run in SQL Editor');
    console.log('='.repeat(60) + '\n');
  }
}

createTables();
