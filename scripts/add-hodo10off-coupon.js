require('dotenv').config();
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');

async function fetchAndAddCoupon() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Fetch all existing coupons
    console.log('\n📋 Fetching all existing coupons...\n');
    const existingCoupons = await Coupon.find({}).sort({ createdAt: -1 });
    
    console.log(`Found ${existingCoupons.length} existing coupons:\n`);
    existingCoupons.forEach((coupon, index) => {
      console.log(`${index + 1}. ${coupon.code}`);
      console.log(`   Description: ${coupon.description}`);
      console.log(`   Type: ${coupon.discountType} - ${coupon.discountValue}${coupon.discountType === 'percentage' ? '%' : ' Rs'}`);
      console.log(`   Usage Type: ${coupon.usageType}`);
      console.log(`   Active: ${coupon.isActive}`);
      console.log(`   Valid: ${coupon.validFrom.toLocaleDateString()} to ${coupon.validUntil.toLocaleDateString()}`);
      console.log(`   Min Booking: Rs ${coupon.minBookingAmount}`);
      console.log(`   Current Usage: ${coupon.currentUsageCount}`);
      console.log(`   New Users Only: ${coupon.newUsersOnly}`);
      console.log(`   Applicable On: ${coupon.applicableOn}`);
      if (coupon.maxDiscountAmount) {
        console.log(`   Max Discount: Rs ${coupon.maxDiscountAmount}`);
      }
      console.log('');
    });

    // 2. Check if HODO10OFF already exists
    const existingHodo10 = await Coupon.findOne({ code: 'HODO10OFF' });
    
    if (existingHodo10) {
      console.log('⚠️  HODO10OFF coupon already exists!');
      console.log('Current details:');
      console.log(JSON.stringify(existingHodo10, null, 2));
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('\nDo you want to update it? (yes/no): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
      
      // Update existing coupon
      existingHodo10.description = 'Flat 10% off on all bookings - No restrictions';
      existingHodo10.discountType = 'percentage';
      existingHodo10.discountValue = 10;
      existingHodo10.maxDiscountAmount = null; // No cap
      existingHodo10.usageType = 'unlimited';
      existingHodo10.maxTotalUsage = null;
      existingHodo10.maxUsagePerUser = null;
      existingHodo10.newUsersOnly = false;
      existingHodo10.specificUsers = [];
      existingHodo10.excludedUsers = [];
      existingHodo10.applicableOn = 'all';
      existingHodo10.properties = [];
      existingHodo10.cities = [];
      existingHodo10.minBookingAmount = 0;
      existingHodo10.minNights = 1;
      existingHodo10.isActive = true;
      existingHodo10.validFrom = new Date();
      existingHodo10.validUntil = new Date('2025-12-31'); // Valid for 1 year+
      
      await existingHodo10.save();
      console.log('\n✅ HODO10OFF coupon updated successfully!');
    } else {
      // 3. Create new HODO10OFF coupon
      console.log('\n🎉 Creating new HODO10OFF coupon...\n');
      
      const newCoupon = new Coupon({
        code: 'HODO10OFF',
        description: 'Flat 10% off on all bookings - No restrictions',
        isActive: true,
        
        // Discount Configuration
        discountType: 'percentage',
        discountValue: 10,
        maxDiscountAmount: null, // No cap on discount
        
        // Usage Restrictions - UNLIMITED
        usageType: 'unlimited',
        maxTotalUsage: null,
        maxUsagePerUser: null,
        currentUsageCount: 0,
        
        // User Eligibility - NO RESTRICTIONS
        newUsersOnly: false,
        specificUsers: [],
        excludedUsers: [],
        
        // Scope Restrictions - ALL PROPERTIES
        applicableOn: 'all',
        properties: [],
        cities: [],
        
        // Validity Period - Long term
        validFrom: new Date(),
        validUntil: new Date('2025-12-31'), // Valid for 1 year+
        
        // Minimum Requirements - NONE
        minBookingAmount: 0,
        minNights: 1,
        
        // Metadata
        createdBy: 'admin',
        notes: 'Universal coupon with no restrictions - any user can use unlimited times'
      });
      
      await newCoupon.save();
      console.log('✅ HODO10OFF coupon created successfully!');
    }

    // 4. Verify the coupon
    const verifiedCoupon = await Coupon.findOne({ code: 'HODO10OFF' });
    console.log('\n📝 Final HODO10OFF Coupon Details:\n');
    console.log(JSON.stringify(verifiedCoupon, null, 2));
    
    console.log('\n✨ All done! The HODO10OFF coupon is ready to use.');
    console.log('\nCoupon Summary:');
    console.log('- Code: HODO10OFF');
    console.log('- Discount: 10% off (no maximum cap)');
    console.log('- Usage: Unlimited times by any user');
    console.log('- Restrictions: None');
    console.log('- Applicable: All properties and cities');
    console.log('- Valid Until: December 31, 2025');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
fetchAndAddCoupon();
