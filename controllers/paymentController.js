const { Booking, Unit } = require('../models');
const Coupon = require('../models/Coupon');
const couponService = require('../services/couponService');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');
const emailService = require('../services/emailService');
const slackService = require('../services/slackService');
const mongoose = require('mongoose');
const razorpayService = require('../services/razorpayService');
const gstCalculator = require('../utils/gstCalculator');

const xmlParser = new XMLParser();

class PaymentController {
  // Create Razorpay order
  async createOrder(req, res) {
    try {
      const { amount, currency = 'INR', bookingData } = req.body;

      // Validate required fields
      if (!amount || !bookingData) {
        return res.status(400).json({
          success: false,
          message: 'Amount and booking data are required'
        });
      }

      // Validate amount is positive
      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than zero'
        });
      }

      // Validate booking data
      if (!bookingData.unitId || !bookingData.checkIn || !bookingData.checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking data'
        });
      }

      // CRITICAL: Final availability check before creating payment order
      console.log('🔍 Backend: Performing final availability check before payment...');
      const PropertyDailyCache = require('../models/PropertyDailyCache');
      
      const checkInDate = new Date(bookingData.checkIn);
      const checkOutDate = new Date(bookingData.checkOut);
      
      const cachedDays = await PropertyDailyCache.find({
        unitId: bookingData.unitId,
        date: {
          $gte: checkInDate,
          $lt: checkOutDate
        }
      });

      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      
      if (cachedDays.length !== nights) {
        console.log('❌ Backend: Availability data incomplete');
        return res.status(400).json({
          success: false,
          message: 'Unable to verify availability. Please refresh and try again.'
        });
      }

      const allAvailable = cachedDays.every(day => day.isAvailable);
      
      if (!allAvailable) {
        console.log('❌ Backend: Unit not available for selected dates');
        return res.status(400).json({
          success: false,
          message: 'This unit is no longer available for the selected dates. It may have been booked by another guest.'
        });
      }

      console.log('✅ Backend: Availability confirmed');

      // Generate unique receipt ID
      const receipt = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create Razorpay order
      const result = await razorpayService.createOrder({
        amount: amount,
        currency: currency,
        receipt: receipt,
        notes: {
          unitId: bookingData.unitId,
          checkIn: bookingData.checkIn,
          checkOut: bookingData.checkOut,
          guests: bookingData.numberOfGuests
        }
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create payment order',
          error: result.error
        });
      }

      console.log('✅ Razorpay order created:', result.order.id);

      res.json({
        success: true,
        data: {
          orderId: result.order.id,
          amount: result.order.amount,
          currency: result.order.currency,
          key: process.env.RAZORPAY_KEY_ID
        }
      });

    } catch (error) {
      console.error('❌ Error creating Razorpay order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment order',
        error: error.message
      });
    }
  }

  // Verify payment and create booking
  async verifyPayment(req, res) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          bookingData
        } = req.body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingData) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Missing required payment or booking data'
          });
        }

        // Verify Razorpay signature using secure service
        const isValid = razorpayService.verifyPaymentSignature({
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature
        });

        if (!isValid) {
          await session.abortTransaction();
          console.error('❌ Payment signature verification failed');
          return res.status(400).json({
            success: false,
            message: 'Invalid payment signature. Payment verification failed.'
          });
        }

        console.log('✅ Payment signature verified successfully');

        // Get unit details
        const unit = await Unit.findById(bookingData.unitId).session(session);
        if (!unit) {
          await session.abortTransaction();
          return res.status(404).json({
            success: false,
            message: 'Unit not found'
          });
        }

        // Calculate nights
        const checkInDate = new Date(bookingData.checkIn);
        const checkOutDate = new Date(bookingData.checkOut);
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

        console.log('📊 Received booking data:');
        console.log(`   Original price from client: ₹${bookingData.pricing.clientPrice}`);
        console.log(`   Nights: ${nights}`);
        console.log(`   Coupon code: ${bookingData.couponCode || 'None'}`);
        console.log(`   Final price with GST from client: ₹${bookingData.pricing.finalPriceWithGST || 'Not provided'}`);

        // Handle coupon if provided
        let couponDiscount = 0;
        let originalPrice = bookingData.pricing.clientPrice;
        let priceAfterCoupon = bookingData.pricing.clientPrice;
        let appliedCouponCode = null;
        let couponId = null;

        if (bookingData.couponCode) {
          try {
            console.log('🎟️  Applying coupon:', bookingData.couponCode);

            // Validate coupon
            const validation = await couponService.validateCoupon(
              bookingData.couponCode,
              {
                email: bookingData.guestInfo.email,
                phone: bookingData.guestInfo.phone,
                propertyId: bookingData.unitId,
                city: unit.city,
                bookingAmount: bookingData.pricing.clientPrice,
                nights: nights
              }
            );

            if (!validation.valid) {
              await session.abortTransaction();
              return res.status(400).json({
                success: false,
                message: validation.error
              });
            }

            couponDiscount = validation.discount.amount;
            priceAfterCoupon = validation.discount.finalPrice;
            originalPrice = validation.discount.originalPrice; // Use original price from validation
            appliedCouponCode = bookingData.couponCode.toUpperCase();

            // Get coupon for reference
            const coupon = await Coupon.findOne({ code: appliedCouponCode }).session(session);
            couponId = coupon?._id;

            console.log(`✅ Coupon validated: ${couponDiscount} discount, price after coupon: ${priceAfterCoupon}`);
          } catch (couponError) {
            await session.abortTransaction();
            console.error('❌ Coupon validation failed:', couponError.message);
            return res.status(400).json({
              success: false,
              message: `Coupon error: ${couponError.message}`
            });
          }
        }

        // CRITICAL: Calculate GST on server side (after coupon discount)
        console.log('💰 Calculating GST on server...');
        let gstCalculation;
        try {
          gstCalculation = gstCalculator.calculateGST(priceAfterCoupon, nights);
          console.log(`✅ GST calculated: ${gstCalculation.gstRate}% = ₹${gstCalculation.gstAmount}`);
          console.log(`   Price before GST: ₹${gstCalculation.priceBeforeGST}`);
          console.log(`   Final price with GST: ₹${gstCalculation.finalPrice}`);
        } catch (gstError) {
          await session.abortTransaction();
          console.error('❌ GST calculation failed:', gstError.message);
          return res.status(500).json({
            success: false,
            message: 'Failed to calculate GST'
          });
        }

        // SECURITY: Validate that client sent the correct amount including GST
        if (bookingData.pricing.finalPriceWithGST) {
          const validation = gstCalculator.validateGSTCalculation(
            bookingData.pricing.finalPriceWithGST,
            priceAfterCoupon,
            nights
          );

          if (!validation.valid) {
            await session.abortTransaction();
            console.error('❌ GST validation failed:', validation.error);
            return res.status(400).json({
              success: false,
              message: validation.error,
              details: {
                expected: validation.expected,
                received: validation.received
              }
            });
          }
          console.log('✅ Client GST calculation validated');
        }

        const finalPriceWithGST = gstCalculation.finalPrice;

        // Create booking in MongoDB
        const booking = new Booking({
          unitId: bookingData.unitId,
          buildingId: unit.buildingId,
          ruPropertyId: unit.ruPropertyId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights: nights,
          guestInfo: {
            name: bookingData.guestInfo.name,
            surname: bookingData.guestInfo.surname,
            email: bookingData.guestInfo.email,
            phone: bookingData.guestInfo.phone,
            address: bookingData.guestInfo.address || '',
            zipCode: bookingData.guestInfo.zipCode || ''
          },
          numberOfGuests: bookingData.numberOfGuests,
          numberOfAdults: bookingData.numberOfAdults || bookingData.numberOfGuests,
          numberOfChildren: bookingData.numberOfChildren || 0,
          numberOfInfants: bookingData.numberOfInfants || 0,
          pricing: {
            // RU API fields
            ruPrice: priceAfterCoupon,           // Price after coupon (before GST) - for property owner
            clientPrice: finalPriceWithGST,      // Final price with GST - what customer paid
            alreadyPaid: finalPriceWithGST,      // Full amount paid by customer
            currency: 'INR',
            
            // Coupon tracking
            originalPrice: originalPrice,         // Original price before coupon
            discountAmount: couponDiscount,       // Coupon discount amount
            finalPrice: priceAfterCoupon,         // Price after coupon (same as priceBeforeGST)
            
            // GST tracking
            priceBeforeGST: gstCalculation.priceBeforeGST,  // Price before GST (after coupon)
            gstRate: gstCalculation.gstRate,                 // GST percentage (5 or 18)
            gstAmount: gstCalculation.gstAmount,             // GST amount
            finalPriceWithGST: finalPriceWithGST,            // Final price with GST
            pricePerNight: gstCalculation.pricePerNight      // Per night price for GST calculation
          },
          appliedCoupon: appliedCouponCode,
          couponId: couponId,
          payment: {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            signature: razorpay_signature,
            status: 'completed',
            method: 'razorpay',
            paidAt: new Date()
          },
          status: 'pending',
          specialRequests: bookingData.specialRequests || ''
        });

        await booking.save({ session });

        console.log('✅ Booking saved to MongoDB:', booking.bookingReference);
        console.log('📊 Pricing Summary:');
        console.log(`   - Original Price: ₹${originalPrice}`);
        console.log(`   - Coupon Discount: ₹${couponDiscount}`);
        console.log(`   - Price After Coupon: ₹${priceAfterCoupon}`);
        console.log(`   - GST (${gstCalculation.gstRate}%): ₹${gstCalculation.gstAmount}`);
        console.log(`   - Final Price (with GST): ₹${finalPriceWithGST}`);
        console.log(`   - RU Price (sent to property): ₹${priceAfterCoupon}`);
        console.log(`   - Client Price (sent to RU): ₹${finalPriceWithGST}`);

        // Apply coupon usage tracking
        if (appliedCouponCode) {
          try {
            await couponService.applyCoupon(
              appliedCouponCode,
              {
                email: bookingData.guestInfo.email,
                phone: bookingData.guestInfo.phone,
                propertyId: bookingData.unitId,
                city: unit.city,
                bookingAmount: originalPrice,
                nights: nights,
                bookingId: booking._id
              },
              session
            );
            console.log('✅ Coupon usage recorded');
          } catch (couponError) {
            console.error('⚠️  Coupon usage tracking failed:', couponError.message);
            // Don't fail booking if tracking fails
          }
        }

        console.log('✅ Booking saved to MongoDB:', booking.bookingReference);

        // Commit transaction before external RU API call
        await session.commitTransaction();

        // Create reservation in Rentals United
        try {
          // Validate guest count against unit capacity
          const maxGuests = unit.canSleepMax || unit.standardGuests || 1;
          const actualGuests = Math.min(bookingData.numberOfGuests, maxGuests);

          if (bookingData.numberOfGuests > maxGuests) {
            console.log(`⚠️  Guest count (${bookingData.numberOfGuests}) exceeds max capacity (${maxGuests}). Using ${actualGuests} for RU API.`);
          }

          // PRICING FOR RENTALS UNITED:
          // - RUPrice: Price after coupon (before GST) - what property owner receives
          // - ClientPrice: Final price with GST - what customer actually paid
          // - AlreadyPaid: Same as ClientPrice - customer has paid in full
          
          const ruPrice = priceAfterCoupon; // Price after coupon, before GST
          const clientPrice = finalPriceWithGST; // Final price including GST
          const alreadyPaid = finalPriceWithGST; // Customer paid full amount
          
          console.log(`💰 RU Pricing Breakdown:`);
          console.log(`   - Original Price: ₹${originalPrice}`);
          console.log(`   - Coupon Discount: ₹${couponDiscount}`);
          console.log(`   - Price After Coupon (RUPrice): ₹${ruPrice}`);
          console.log(`   - GST (${gstCalculation.gstRate}%): ₹${gstCalculation.gstAmount}`);
          console.log(`   - Client Price (with GST): ₹${clientPrice}`);
          console.log(`   - Already Paid: ₹${alreadyPaid}`);

          const ruReservationData = {
            propertyId: unit.ruPropertyId,
            dateFrom: checkInDate.toISOString().split('T')[0],
            dateTo: checkOutDate.toISOString().split('T')[0],
            numberOfGuests: actualGuests,
            ruPrice: ruPrice,           // Price after coupon (before GST) - for property owner
            clientPrice: clientPrice,   // Final price with GST - what customer paid
            alreadyPaid: alreadyPaid,   // Full amount paid by customer
            customerName: bookingData.guestInfo.name,
            customerSurname: bookingData.guestInfo.surname,
            customerEmail: bookingData.guestInfo.email,
            customerPhone: bookingData.guestInfo.phone,
            customerAddress: bookingData.guestInfo.address,
            customerZipCode: bookingData.guestInfo.zipCode,
            comments: bookingData.specialRequests || ''
          };

          console.log('📤 Pushing reservation to RU with pricing:', {
            ruPrice,
            clientPrice,
            alreadyPaid
          });

          const ruResponse = await ruClient.pushPutConfirmedReservationMulti(ruReservationData);
          const parsedResponse = xmlParser.parse(ruResponse);

          console.log('RU API Response:', parsedResponse);

          if (parsedResponse.Push_PutConfirmedReservationMulti_RS) {
            const response = parsedResponse.Push_PutConfirmedReservationMulti_RS;

            // Check if Status indicates an error (Status with ID attribute or error message)
            const status = response.Status;
            const statusId = status?.['@_ID'];
            const statusText = typeof status === 'string' ? status : status?.['#text'];

            // If status has an error ID or error message, throw error
            if (statusId || (statusText && statusText.toLowerCase().includes('error'))) {
              throw new Error(`RU reservation failed: ${statusText || 'Unknown error'}`);
            }

            const ruReservationId = response.ReservationID;

            if (!ruReservationId) {
              throw new Error('RU did not return a ReservationID');
            }

            // Update booking with RU reservation ID
            booking.ruReservationId = ruReservationId;
            booking.ruStatus = statusText || 'Confirmed';
            booking.status = 'confirmed';
            await booking.save();

            console.log('✅ Reservation created in RU:', ruReservationId);

            // Update cache to mark dates as unavailable
            const PropertyDailyCache = require('../models/PropertyDailyCache');
            await PropertyDailyCache.updateMany(
              {
                unitId: unit._id,
                date: {
                  $gte: checkInDate,
                  $lt: checkOutDate
                }
              },
              {
                $set: {
                  isAvailable: false,
                  lastSynced: new Date()
                }
              }
            );
            console.log('✅ Cache updated - dates marked as unavailable');
          } else {
            throw new Error('Invalid RU API response structure');
          }
        } catch (ruError) {
          console.error('❌ Error creating RU reservation:', ruError.message);
          // Booking is still saved in our DB, but not in RU
          // Admin can manually sync later
          booking.ruStatus = `Error: ${ruError.message}`;
          await booking.save();
        }

        // Populate unit details for response
        await booking.populate('unitId');
        await booking.populate('buildingId');

        // Send booking confirmation email with access token
        try {
          await emailService.sendBookingConfirmation(booking);
          console.log('✅ Booking confirmation email sent to:', booking.guestInfo.email);
        } catch (emailError) {
          console.error('❌ Error sending confirmation email:', emailError);
          // Don't fail the booking if email fails
        }

        // Send Slack notification for new booking
        try {
          await slackService.sendBookingNotification(booking);
          console.log('✅ Slack notification sent for booking:', booking.bookingReference);
        } catch (slackError) {
          console.error('❌ Error sending Slack notification:', slackError);
          // Don't fail the booking if Slack notification fails
        }

        res.json({
          success: true,
          message: 'Payment verified and booking confirmed',
          data: {
            booking: {
              _id: booking._id,
              bookingReference: booking.bookingReference,
              ruReservationId: booking.ruReservationId,
              status: booking.status,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              nights: booking.nights,
              guestInfo: booking.guestInfo,
              pricing: booking.pricing,
              appliedCoupon: booking.appliedCoupon,
              accessToken: booking.accessToken,
              unit: {
                name: booking.unitId.name,
                images: booking.unitId.images
              }
            }
          }
        });

      } catch (error) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        console.error('Error verifying payment:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to verify payment and create booking',
          error: error.message
        });
      } finally {
        session.endSession();
      }
    }



  // Handle Razorpay webhooks
  async handleWebhook(req, res) {
    try {
      const webhookSignature = req.headers['x-razorpay-signature'];
      const webhookBody = JSON.stringify(req.body);

      // Verify webhook signature using secure service
      const isValid = razorpayService.verifyWebhookSignature(webhookBody, webhookSignature);

      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      const event = req.body.event;
      const payload = req.body.payload;

      console.log('Webhook received:', event);

      // Handle different webhook events
      switch (event) {
        case 'payment.captured':
          // Payment was captured successfully
          console.log('Payment captured:', payload.payment.entity.id);
          break;

        case 'payment.failed':
          // Payment failed
          console.log('Payment failed:', payload.payment.entity.id);
          // Update booking status if exists
          await Booking.updateOne(
            { 'payment.paymentId': payload.payment.entity.id },
            {
              'payment.status': 'failed',
              status: 'cancelled'
            }
          );
          break;

        case 'refund.created':
          // Refund was created
          console.log('Refund created:', payload.refund.entity.id);
          break;

        default:
          console.log('Unhandled webhook event:', event);
      }

      res.json({ success: true });

    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message
      });
    }
  }
}

const paymentController = new PaymentController();
module.exports = paymentController;

