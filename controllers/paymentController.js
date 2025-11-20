const { Booking, Unit } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');
const emailService = require('../services/emailService');
const razorpayService = require('../services/razorpayService');

const xmlParser = new XMLParser();

class PaymentController {
  // Create Razorpay order
  async createOrder(req, res) {
    try {
      const { amount, currency = 'USD', bookingData } = req.body;

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

      // Generate unique receipt ID
      const receipt = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create Razorpay order using service
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
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bookingData
      } = req.body;

      // Validate required fields
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingData) {
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
        console.error('❌ Payment signature verification failed');
        return res.status(400).json({
          success: false,
          message: 'Invalid payment signature. Payment verification failed.'
        });
      }

      console.log('✅ Payment signature verified successfully');

      // Get unit details
      const unit = await Unit.findById(bookingData.unitId);
      if (!unit) {
        return res.status(404).json({
          success: false,
          message: 'Unit not found'
        });
      }

      // Calculate nights
      const checkInDate = new Date(bookingData.checkIn);
      const checkOutDate = new Date(bookingData.checkOut);
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

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
          ruPrice: bookingData.pricing.ruPrice,
          clientPrice: bookingData.pricing.clientPrice,
          alreadyPaid: bookingData.pricing.clientPrice,
          currency: bookingData.pricing.currency || 'INR'
        },
        payment: {
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          signature: razorpay_signature,
          status: 'completed',
          method: 'razorpay',
          paidAt: new Date()
        },
        status: 'pending', // Will be 'confirmed' after RU API call
        specialRequests: bookingData.specialRequests || ''
      });

      await booking.save();

      console.log('✅ Booking saved to MongoDB:', booking.bookingReference);

      // Create reservation in Rentals United
      try {
        // Validate guest count against unit capacity
        const maxGuests = unit.canSleepMax || unit.standardGuests || 1;
        const actualGuests = Math.min(bookingData.numberOfGuests, maxGuests);

        if (bookingData.numberOfGuests > maxGuests) {
          console.log(`⚠️  Guest count (${bookingData.numberOfGuests}) exceeds max capacity (${maxGuests}). Using ${actualGuests} for RU API.`);
        }

        const ruReservationData = {
          propertyId: unit.ruPropertyId,
          dateFrom: checkInDate.toISOString().split('T')[0],
          dateTo: checkOutDate.toISOString().split('T')[0],
          numberOfGuests: actualGuests,
          ruPrice: bookingData.pricing.ruPrice,
          clientPrice: bookingData.pricing.clientPrice,
          alreadyPaid: bookingData.pricing.clientPrice,
          customerName: bookingData.guestInfo.name,
          customerSurname: bookingData.guestInfo.surname,
          customerEmail: bookingData.guestInfo.email,
          customerPhone: bookingData.guestInfo.phone,
          customerAddress: bookingData.guestInfo.address,
          customerZipCode: bookingData.guestInfo.zipCode,
          comments: bookingData.specialRequests || ''
        };

        const ruResponse = await ruClient.pushPutConfirmedReservationMulti(ruReservationData);
        const parsedResponse = xmlParser.parse(ruResponse);

        console.log('RU API Response:', parsedResponse);

        if (parsedResponse.Push_PutConfirmedReservationMulti_RS) {
          const ruReservationId = parsedResponse.Push_PutConfirmedReservationMulti_RS.ReservationID;
          const ruStatus = parsedResponse.Push_PutConfirmedReservationMulti_RS.Status;

          // Update booking with RU reservation ID
          booking.ruReservationId = ruReservationId;
          booking.ruStatus = ruStatus;
          booking.status = 'confirmed';
          await booking.save();

          console.log('✅ Reservation created in RU:', ruReservationId);
        }
      } catch (ruError) {
        console.error('❌ Error creating RU reservation:', ruError);
        // Booking is still saved in our DB, but not in RU
        // Admin can manually sync later
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
            accessToken: booking.accessToken,
            unit: {
              name: booking.unitId.name,
              images: booking.unitId.images
            }
          }
        }
      });

    } catch (error) {
      console.error('Error verifying payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify payment and create booking',
        error: error.message
      });
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
