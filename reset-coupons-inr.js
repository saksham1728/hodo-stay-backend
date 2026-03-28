require('dotenv').config();
const mongoose = require('mongoose');
const Coupon = require('./models/Coupon');

async function resetCoupons() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Step 1: Delete all existing coupons
    console.log('🗑️  Deleting all existing coupons...');
    const deleteResult = await Coupon.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} old coupons\n`);
    
    // Step 2: Create new coupons with INR values
    console.log('📝 Creating new coupons with INR values...\n');
    
    const newCoupons = [
      // Welcome discount - 10% off
      {
        code: 'WELCOME10',
        description: 'Welcome discount - 10% off on your first booking',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscountAmount: 2000, // Max ₹2000 discount
        usageType: 'limited_per_user',
        maxUsagePerUser: 1,
        newUsersOnly: true,
        minBookingAmount: 3000, // Min ₹3000 booking
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2026-12-31'),
        applicableOn: 'all',
        notes: 'First-time user discount'
      },
      
      // Flat ₹500 off
      {
        code: 'FLAT500',
        description: 'Flat ₹500 off on bookings above ₹5000',
        discountType: 'fixed',
        discountValue: 500,
        usageType: 'unlimited',
        minBookingAmount: 5000,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2026-12-31'),
        applicableOn: 'all',
        notes: 'General discount coupon'
      },
      
      // Flat ₹1000 off
      {
        code: 'FLAT1000',
        description: 'Flat ₹1000 off on bookings above ₹10000',
        discountType: 'fixed',
        discountValue: 1000,
        usageType: 'unlimited',
        minBookingAmount: 10000,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2026-12-31'),
        applicableOn: 'all',
        notes: 'Higher value discount'
      },
      
      // Weekend special - 15% off
      {
        code: 'WEEKEND15',
        description: 'Weekend special - 15% off',
        discountType: 'percentage',
        discountValue: 15,
        maxDiscountAmount: 3000, // Max ₹3000 discount
        usageType: 'unlimited',
        minBookingAmount: 4000,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2026-12-31'),
        applicableOn: 'all',
        notes: 'Weekend promotion'
      },
      
      // Long stay discount - 20% off
      {
        code: 'LONGSTAY20',
        description: 'Long stay discount - 20% off for 7+ nights',
        discountType: 'percentage',
        discountValue: 20,
        maxDiscountAmount: 5000, // Max ₹5000 discount
        usageType: 'unlimited',
        minNights: 7,
        minBookingAmount: 15000,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2026-12-31'),
        applicableOn: 'all',
        notes: 'Extended stay discount'
      },
      
      // Early bird - ₹2000 off
      {
        code: 'EARLYBIRD2000',
        description: 'Early bird special - ₹2000 off',
        discountType: 'fixed',
        discountValue: 2000,
        usageType: 'limited_total',
        maxTotalUsage: 100,
        minBookingAmount: 12000,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2026-06-30'),
        applicableOn: 'all',
        notes: 'Limited time offer'
      },
      
      // Super saver - 25% off
      {
        code: 'SUPERSAVER25',
        description: 'Super saver - 25% off on premium properties',
        discountType: 'percentage',
        discountValue: 25,
        maxDiscountAmount: 7500, // Max ₹7500 discount
        usageType: 'limited_total',
        maxTotalUsage: 50,
        minBookingAmount: 20000,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2026-12-31'),
        applicableOn: 'all',
        notes: 'Premium discount'
      },
      
      // Flash sale - ₹3000 off
      {
        code: 'FLASH3000',
        description: 'Flash sale - ₹3000 off',
        discountType: 'fixed',
        discountValue: 3000,
        usageType: 'limited_total',
        maxTotalUsage: 25,
        minBookingAmount: 15000,
        validFrom: new Date('2026-03-01'),
        validUntil: new Date('2026-04-30'),
        applicableOn: 'all',
        notes: 'Limited flash sale'
      }
    ];
    
    // Insert all coupons
    const insertedCoupons = await Coupon.insertMany(newCoupons);
    
    console.log(`✅ Created ${insertedCoupons.length} new coupons:\n`);
    
    insertedCoupons.forEach(coupon => {
      const discountDisplay = coupon.discountType === 'percentage' 
        ? `${coupon.discountValue}% off (max ₹${coupon.maxDiscountAmount})`
        : `₹${coupon.discountValue} off`;
      
      console.log(`   📌 ${coupon.code}`);
      console.log(`      ${coupon.description}`);
      console.log(`      Discount: ${discountDisplay}`);
      console.log(`      Min Amount: ₹${coupon.minBookingAmount}`);
      console.log(`      Usage: ${coupon.usageType}`);
      console.log('');
    });
    
    console.log('✅ All coupons reset successfully with INR values!');
    
    await mongoose.connection.close();
    console.log('\n👋 Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetCoupons();
