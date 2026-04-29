/**
 * Data Import Module
 * Imports transformed data into PostgreSQL/Supabase
 * Task 12.3: Create data import module
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const transformedDir = path.join(__dirname, 'data', 'transformed');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Import data in batches to avoid timeout
 */
async function importInBatches(tableName, data, batchSize = 100) {
  console.log(`\n📥 Importing ${data.length} records into ${tableName}...`);
  
  let imported = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(data.length / batchSize);
    
    try {
      const { data: inserted, error } = await supabase
        .from(tableName)
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error(`❌ Batch ${batchNum}/${totalBatches} failed:`, error.message);
        failed += batch.length;
        errors.push({ batch: batchNum, error: error.message, records: batch.length });
      } else {
        imported += inserted.length;
        process.stdout.write(`\r   Progress: ${batchNum}/${totalBatches} batches (${imported}/${data.length} records)`);
      }
    } catch (error) {
      console.error(`❌ Batch ${batchNum}/${totalBatches} exception:`, error.message);
      failed += batch.length;
      errors.push({ batch: batchNum, error: error.message, records: batch.length });
    }
  }
  
  console.log(''); // New line after progress
  
  return { imported, failed, errors };
}

/**
 * Import a single collection
 */
async function importCollection(collectionName, tableName) {
  console.log(`\n📦 Importing ${collectionName} → ${tableName}`);
  
  try {
    const filePath = path.join(transformedDir, `${collectionName}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (data.length === 0) {
      console.log(`⚠️  No data to import for ${collectionName}`);
      return { collection: collectionName, imported: 0, failed: 0, errors: [] };
    }
    
    const result = await importInBatches(tableName, data);
    
    if (result.imported > 0) {
      console.log(`✅ Successfully imported ${result.imported} records`);
    }
    if (result.failed > 0) {
      console.log(`⚠️  Failed to import ${result.failed} records`);
    }
    
    return {
      collection: collectionName,
      table: tableName,
      ...result
    };
    
  } catch (error) {
    console.error(`❌ Error importing ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Validate foreign key relationships
 */
async function validateForeignKeys() {
  console.log('\n🔍 Validating foreign key relationships...');
  
  const validations = [];
  
  try {
    // Check bookings → units
    const { data: orphanedBookingsUnits } = await supabase
      .from('ho_bookings')
      .select('id, unit_id')
      .not('unit_id', 'is', null);
    
    if (orphanedBookingsUnits) {
      const unitIds = new Set();
      const { data: units } = await supabase.from('ho_units').select('id');
      units.forEach(u => unitIds.add(u.id));
      
      const orphaned = orphanedBookingsUnits.filter(b => !unitIds.has(b.unit_id));
      validations.push({
        check: 'ho_bookings.unit_id → ho_units.id',
        valid: orphaned.length === 0,
        orphaned: orphaned.length
      });
    }
    
    // Check bookings → buildings
    const { data: orphanedBookingsBuildings } = await supabase
      .from('ho_bookings')
      .select('id, building_id')
      .not('building_id', 'is', null);
    
    if (orphanedBookingsBuildings) {
      const buildingIds = new Set();
      const { data: buildings } = await supabase.from('ho_buildings').select('id');
      buildings.forEach(b => buildingIds.add(b.id));
      
      const orphaned = orphanedBookingsBuildings.filter(b => !buildingIds.has(b.building_id));
      validations.push({
        check: 'ho_bookings.building_id → ho_buildings.id',
        valid: orphaned.length === 0,
        orphaned: orphaned.length
      });
    }
    
    // Check units → buildings
    const { data: orphanedUnits } = await supabase
      .from('ho_units')
      .select('id, building_id')
      .not('building_id', 'is', null);
    
    if (orphanedUnits) {
      const buildingIds = new Set();
      const { data: buildings } = await supabase.from('ho_buildings').select('id');
      buildings.forEach(b => buildingIds.add(b.id));
      
      const orphaned = orphanedUnits.filter(u => !buildingIds.has(u.building_id));
      validations.push({
        check: 'ho_units.building_id → ho_buildings.id',
        valid: orphaned.length === 0,
        orphaned: orphaned.length
      });
    }
    
    // Print validation results
    console.log('\n' + '='.repeat(60));
    console.log('FOREIGN KEY VALIDATION');
    console.log('='.repeat(60));
    validations.forEach(v => {
      const status = v.valid ? '✅' : '❌';
      console.log(`${status} ${v.check.padEnd(45)} ${v.orphaned} orphaned`);
    });
    console.log('='.repeat(60));
    
    return validations;
    
  } catch (error) {
    console.error('❌ Validation error:', error.message);
    return [];
  }
}

/**
 * Validate record counts
 */
async function validateRecordCounts(importResults) {
  console.log('\n🔍 Validating record counts...');
  
  const validations = [];
  
  for (const result of importResults) {
    try {
      const { count, error } = await supabase
        .from(result.table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error(`❌ Error counting ${result.table}:`, error.message);
        continue;
      }
      
      const expected = result.imported;
      const actual = count;
      const match = expected === actual;
      
      validations.push({
        table: result.table,
        expected,
        actual,
        match
      });
      
    } catch (error) {
      console.error(`❌ Error validating ${result.table}:`, error.message);
    }
  }
  
  // Print validation results
  console.log('\n' + '='.repeat(60));
  console.log('RECORD COUNT VALIDATION');
  console.log('='.repeat(60));
  validations.forEach(v => {
    const status = v.match ? '✅' : '❌';
    console.log(`${status} ${v.table.padEnd(30)} Expected: ${v.expected.toString().padStart(5)} | Actual: ${v.actual.toString().padStart(5)}`);
  });
  console.log('='.repeat(60));
  
  return validations;
}

/**
 * Main import function
 */
async function importAllData() {
  console.log('🚀 Starting data import to PostgreSQL/Supabase...\n');
  console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
  
  const startTime = Date.now();
  const results = [];
  
  try {
    // Import in order respecting foreign key dependencies
    // 1. Buildings (no dependencies)
    results.push(await importCollection('buildings', 'ho_buildings'));
    
    // 2. Units (depends on buildings)
    results.push(await importCollection('units', 'ho_units'));
    
    // 3. Users (no dependencies)
    results.push(await importCollection('users', 'ho_users'));
    
    // 4. Coupons (may reference units)
    results.push(await importCollection('coupons', 'ho_coupons'));
    
    // 5. Bookings (depends on buildings, units, users, coupons)
    results.push(await importCollection('bookings', 'ho_bookings'));
    
    // 6. Property daily cache (depends on units)
    results.push(await importCollection('property_daily_cache', 'ho_property_daily_cache'));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Validate data
    const countValidations = await validateRecordCounts(results);
    const fkValidations = await validateForeignKeys();
    
    // Generate import report
    const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    
    const report = {
      importDate: new Date().toISOString(),
      duration: `${duration}s`,
      results,
      totalImported,
      totalFailed,
      validations: {
        recordCounts: countValidations,
        foreignKeys: fkValidations
      }
    };
    
    // Save report
    const reportPath = path.join(__dirname, 'data', 'import-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    results.forEach(r => {
      if (r && r.table) {
        const status = r.failed === 0 ? '✅' : '⚠️';
        console.log(`${status} ${r.table.padEnd(30)} ${r.imported.toString().padStart(5)} imported, ${r.failed.toString().padStart(5)} failed`);
      }
    });
    console.log('='.repeat(60));
    console.log(`Total imported:           ${totalImported.toString().padStart(5)}`);
    console.log(`Total failed:             ${totalFailed.toString().padStart(5)}`);
    console.log(`Duration:                 ${duration}s`);
    console.log(`Report saved to:          ${reportPath}`);
    console.log('='.repeat(60));
    
    // Check if all validations passed
    const allCountsValid = countValidations.every(v => v.match);
    const allFKsValid = fkValidations.every(v => v.valid);
    
    if (allCountsValid && allFKsValid && totalFailed === 0) {
      console.log('\n✅ All validations passed! Migration successful!');
    } else {
      console.log('\n⚠️  Some validations failed. Please review the report.');
    }
    
    return report;
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  }
}

// Run import if called directly
if (require.main === module) {
  importAllData()
    .then(() => {
      console.log('\n✅ Import completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importAllData, importCollection, validateForeignKeys, validateRecordCounts };
