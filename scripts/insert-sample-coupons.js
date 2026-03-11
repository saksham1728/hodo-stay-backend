const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
require('dotenv').config();

const sampleCoupons = [
  {
    code: 'FIRST10',
    description: 'First 10 users get 20% off',
    discountType: 'percentage',
    discountValue: 20,
    maxDiscountAmount: 50,
    usageType: 'limited_total',
    maxTotalUsage: 10,
    newUsersOnly: true,
    applicableOn: 'all',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    minBookingAmount: 50,
    minNights: 1,
    isActive: true
  },
  {
    code: 'WELCOME100',
    description: 'Welcome offer - $10 off for new users',
    discountType: 'fixed',
    discountValue: 10,
    usageType: 'limited_per_user',
    maxUsagePerUser: 1,
    newUsersOnly: true,
    applicableOn: 'all',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    minBookingAmount: 50,
    minNights: 2,
    isActive: true
  },
  {
    code: 'SAVE500',
    description: 'Save $50 on bookings above $200',
    discountType: 'fixed',
    discountValue: 50,
    usageType: 'unlimited',
    applicableOn: 'all',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    minBookingAmount: 200,
    minNights: 3,
    isActive: true
  },
  {
    code: 'WEEKEND15',
    description: '15% off on weekend bookings',
    discountType: 'percentage',
    discountValue: 15,
    maxDiscountAmount: 30,
    usageType: 'limited_per_user',
    maxUsagePerUser: 3,
    applicableOn: 'all',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
    minBookingAmount: 80,
    minNights: 2,
    isActive: true
  },
  {
    code: 'LONGSTAY25',
    description: '25% off on stays of 7+ nights',
    discountType: 'percentage',
    discountValue: 25,
    maxDiscountAmount: 100,
    usageType: 'unlimited',
    applicableOn: 'all',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days
    minBookingAmount: 150,
    minNights: 7,
    isActive: true
  }
];

async function insertSampleCoupons() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing coupons (optional - comment out if you want to keep existing)
    // await Coupon.deleteMany({});
    // console.log('🗑️  Cleared existing coupons');

    // Insert sample coupons
    for (const couponData of sampleCoupons) {
      const existing = await Coupon.findOne({ code: couponData.code });
      if (existing) {
        console.log(`⏭️  Coupon ${couponData.code} already exists, skipping...`);
        continue;
      }

      const coupon = new Coupon(couponData);
      await coupon.save();
      console.log(`✅ Created coupon: ${coupon.code} - ${coupon.description}`);
    }

    console.log('\n🎉 Sample coupons inserted successfully!');
    console.log('\nAvailable Coupons:');
    const allCoupons = await Coupon.find({ isActive: true }).select('code description discountType discountValue');
    allCoupons.forEach(c => {
      const discount = c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue}`;
      console.log(`  - ${c.code}: ${c.description} (${discount} off)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error inserting coupons:', error);
    process.exit(1);
  }
}

insertSampleCoupons();
