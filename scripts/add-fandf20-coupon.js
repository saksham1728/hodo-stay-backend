require('dotenv').config();
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');

async function addFandF20Coupon() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if FANDF20 already exists
    const existingCoupon = await Coupon.findOne({ code: 'FANDF20' });
    
    if (existingCoupon) {
      console.log('⚠️  FANDF20 coupon already exists!');
      console.log('Current details:');
      console.log(JSON.stringify(existingCoupon, null, 2));
      
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
      existingCoupon.description = 'Friends & Family - 20% off, max ₹10,000 discount, 2 uses per user';
      existingCoupon.discountType = 'percentage';
      existingCoupon.discountValue = 20;
      existingCoupon.maxDiscountAmount = 10000;
      existingCoupon.usageType = 'limited_per_user';
      existingCoupon.maxUsagePerUser = 2;
      existingCoupon.maxTotalUsage = null;
      existingCoupon.newUsersOnly = false;
      existingCoupon.specificUsers = [];
      existingCoupon.excludedUsers = [];
      existingCoupon.applicableOn = 'all';
      existingCoupon.properties = [];
      existingCoupon.cities = [];
      existingCoupon.minBookingAmount = 0;
      existingCoupon.minNights = 1;
      existingCoupon.isActive = true;
      existingCoupon.validFrom = new Date();
      existingCoupon.validUntil = new Date('2027-12-31');
      existingCoupon.notes = 'Friends & Family special - 20% discount capped at ₹10,000, limited to 2 uses per user';
      
      await existingCoupon.save();
      console.log('\n✅ FANDF20 coupon updated successfully!');
    } else {
      // Create new FANDF20 coupon
      console.log('\n🎉 Creating new FANDF20 coupon...\n');
      
      const newCoupon = new Coupon({
        code: 'FANDF20',
        description: 'Friends & Family - 20% off, max ₹10,000 discount, 2 uses per user',
        isActive: true,
        
        // Discount Configuration
        discountType: 'percentage',
        discountValue: 20,
        maxDiscountAmount: 10000, // Capped at ₹10,000
        
        // Usage Restrictions - 2 times per user
        usageType: 'limited_per_user',
        maxUsagePerUser: 2,
        maxTotalUsage: null, // No total limit, only per-user limit
        currentUsageCount: 0,
        
        // User Eligibility - No restrictions
        newUsersOnly: false,
        specificUsers: [],
        excludedUsers: [],
        
        // Scope Restrictions - All properties
        applicableOn: 'all',
        properties: [],
        cities: [],
        
        // Validity Period - Until Dec 31, 2027
        validFrom: new Date(),
        validUntil: new Date('2027-12-31'),
        
        // Minimum Requirements - None
        minBookingAmount: 0,
        minNights: 1,
        
        // Metadata
        createdBy: 'admin',
        notes: 'Friends & Family special - 20% discount capped at ₹10,000, limited to 2 uses per user'
      });
      
      await newCoupon.save();
      console.log('✅ FANDF20 coupon created successfully!');
    }

    // Verify the coupon
    const verifiedCoupon = await Coupon.findOne({ code: 'FANDF20' });
    console.log('\n📝 Final FANDF20 Coupon Details:\n');
    console.log(JSON.stringify(verifiedCoupon, null, 2));
    
    console.log('\n✨ All done! The FANDF20 coupon is ready to use.');
    console.log('\nCoupon Summary:');
    console.log('- Code: FANDF20');
    console.log('- Discount: 20% off');
    console.log('- Max Discount Cap: ₹10,000');
    console.log('- Usage: 2 times per user');
    console.log('- Restrictions: None (any user can use)');
    console.log('- Applicable: All properties and cities');
    console.log('- Valid Until: December 31, 2027');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
addFandF20Coupon();
