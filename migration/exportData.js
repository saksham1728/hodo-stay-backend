/**
 * Data Export Module
 * Exports all MongoDB collections to JSON files
 * Task 12.1: Create data export module
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import models
const Booking = require('../models/Booking');
const Unit = require('../models/Unit');
const Building = require('../models/Building');
const User = require('../models/User');
const PropertyDailyCache = require('../models/PropertyDailyCache');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Export a single collection to JSON file
 */
async function exportCollection(Model, collectionName) {
  console.log(`\n📦 Exporting ${collectionName}...`);
  
  try {
    const documents = await Model.find({}).lean();
    const count = documents.length;
    
    const filePath = path.join(dataDir, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
    
    console.log(`✅ Exported ${count} documents to ${filePath}`);
    
    // Validate exported file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);
    
    if (parsed.length !== count) {
      throw new Error(`Validation failed: Expected ${count} documents, got ${parsed.length}`);
    }
    
    return { collection: collectionName, count, filePath };
  } catch (error) {
    console.error(`❌ Error exporting ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Export coupons collection (no Mongoose model, direct query)
 */
async function exportCoupons() {
  console.log(`\n📦 Exporting coupons...`);
  
  try {
    const db = mongoose.connection.db;
    const coupons = await db.collection('coupons').find({}).toArray();
    const count = coupons.length;
    
    const filePath = path.join(dataDir, 'coupons.json');
    fs.writeFileSync(filePath, JSON.stringify(coupons, null, 2));
    
    console.log(`✅ Exported ${count} documents to ${filePath}`);
    
    return { collection: 'coupons', count, filePath };
  } catch (error) {
    console.error(`❌ Error exporting coupons:`, error.message);
    throw error;
  }
}

/**
 * Main export function
 */
async function exportAllData() {
  console.log('🚀 Starting MongoDB data export...\n');
  console.log(`MongoDB URI: ${process.env.MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
  
  const startTime = Date.now();
  const results = [];
  
  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Export each collection
    results.push(await exportCollection(Booking, 'bookings'));
    results.push(await exportCollection(Unit, 'units'));
    results.push(await exportCollection(Building, 'buildings'));
    results.push(await exportCollection(User, 'users'));
    results.push(await exportCollection(PropertyDailyCache, 'property_daily_cache'));
    results.push(await exportCoupons());
    
    // Generate summary report
    const totalDocuments = results.reduce((sum, r) => sum + r.count, 0);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const report = {
      exportDate: new Date().toISOString(),
      duration: `${duration}s`,
      collections: results,
      totalDocuments,
      dataDirectory: dataDir
    };
    
    // Save report
    const reportPath = path.join(dataDir, 'export-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 EXPORT SUMMARY');
    console.log('='.repeat(60));
    results.forEach(r => {
      console.log(`${r.collection.padEnd(25)} ${r.count.toString().padStart(6)} documents`);
    });
    console.log('='.repeat(60));
    console.log(`Total:                    ${totalDocuments.toString().padStart(6)} documents`);
    console.log(`Duration:                 ${duration}s`);
    console.log(`Report saved to:          ${reportPath}`);
    console.log('='.repeat(60));
    
    return report;
    
  } catch (error) {
    console.error('\n❌ Export failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run export if called directly
if (require.main === module) {
  exportAllData()
    .then(() => {
      console.log('\n✅ Export completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Export failed:', error);
      process.exit(1);
    });
}

module.exports = { exportAllData, exportCollection };
