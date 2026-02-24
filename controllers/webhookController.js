const { Booking, Unit } = require('../models');
const PropertyDailyCache = require('../models/PropertyDailyCache');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

class WebhookController {
  /**
   * Handle RU webhook for confirmed reservations
   * POST /api/webhooks/rentals-united
   */
  async handleRUWebhook(req, res) {
    try {
      console.log('📥 RU Webhook received');
      console.log('Headers:', req.headers);
      
      // Get webhook type from header
      const webhookType = req.headers['ru-rlnm-method'];
      console.log('Webhook Type:', webhookType);

      // Parse XML body
      let xmlBody;
      if (typeof req.body === 'string') {
        xmlBody = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        xmlBody = req.body.toString();
      } else {
        xmlBody = JSON.stringify(req.body);
      }

      console.log('Raw XML:', xmlBody);

      const parsed = xmlParser.parse(xmlBody);
      console.log('Parsed Data:', JSON.stringify(parsed, null, 2));

      // Validate authentication
      const savedHash = process.env.RU_WEBHOOK_HASH;
      if (savedHash) {
        const receivedPassword = parsed[webhookType]?.Authentication?.Password;
        if (receivedPassword !== savedHash) {
          console.error('❌ Invalid webhook authentication');
          return res.status(401).json({
            success: false,
            message: 'Invalid authentication'
          });
        }
        console.log('✅ Webhook authenticated');
      }

      // Route to appropriate handler
      switch (webhookType) {
        case 'LNM_PutConfirmedReservation_RQ':
          await this.handleConfirmedReservation(parsed.LNM_PutConfirmedReservation_RQ);
          break;

        case 'LNM_CancelReservation_RQ':
          await this.handleCancellation(parsed.LNM_CancelReservation_RQ);
          break;

        case 'LNM_PutUnconfirmedReservation_RQ':
          console.log('ℹ️  Unconfirmed reservation received (ignoring for now)');
          break;

        case 'LNM_PutLeadReservation_RQ':
          console.log('ℹ️  Lead reservation received (ignoring for now)');
          break;

        default:
          console.log('⚠️  Unknown webhook type:', webhookType);
      }

      // RU doesn't expect a response, but send success anyway
      res.status(200).json({ success: true });

    } catch (error) {
      console.error('❌ Error handling RU webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message
      });
    }
  }

  /**
   * Handle confirmed reservation webhook
   */
  async handleConfirmedReservation(data) {
    try {
      const reservation = data.Reservation;
      const stayInfo = reservation.StayInfos.StayInfo;
      const customerInfo = reservation.CustomerInfo;
      const guestDetails = reservation.GuestDetailsInfo;

      console.log('📋 Processing confirmed reservation:', reservation.ReservationID);

      // Find unit by RU PropertyID
      const unit = await Unit.findOne({ ruPropertyId: stayInfo.PropertyID });
      
      if (!unit) {
        console.error(`❌ Unit not found for PropertyID: ${stayInfo.PropertyID}`);
        return;
      }

      console.log(`✅ Found unit: ${unit.name} (${unit._id})`);

      // Parse dates
      const checkInDate = new Date(stayInfo.DateFrom);
      const checkOutDate = new Date(stayInfo.DateTo);
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

      // Check if booking already exists
      const existingBooking = await Booking.findOne({ ruReservationId: reservation.ReservationID });
      
      if (existingBooking) {
        console.log('ℹ️  Booking already exists, updating...');
        
        // Update existing booking
        existingBooking.status = 'confirmed';
        existingBooking.ruStatus = 'Confirmed via webhook';
        await existingBooking.save();
        
        console.log('✅ Booking updated:', existingBooking.bookingReference);
        return;
      }

      // Create new booking
      const booking = new Booking({
        unitId: unit._id,
        buildingId: unit.buildingId,
        ruPropertyId: unit.ruPropertyId,
        ruReservationId: reservation.ReservationID,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: nights,
        guestInfo: {
          name: customerInfo.Name,
          surname: customerInfo.SurName,
          email: customerInfo.Email || '',
          phone: customerInfo.Phone || '',
          address: customerInfo.Address || '',
          zipCode: customerInfo.ZipCode || ''
        },
        numberOfGuests: stayInfo.NumberOfGuests,
        numberOfAdults: guestDetails?.NumberOfAdults || stayInfo.NumberOfGuests,
        numberOfChildren: guestDetails?.NumberOfChildren || 0,
        numberOfInfants: guestDetails?.NumberOfInfants || 0,
        pricing: {
          ruPrice: parseFloat(stayInfo.Costs.RUPrice),
          clientPrice: parseFloat(stayInfo.Costs.ClientPrice),
          alreadyPaid: parseFloat(stayInfo.Costs.AlreadyPaid),
          currency: 'USD'
        },
        payment: {
          status: 'completed',
          method: 'external',
          paidAt: new Date(reservation.CreatedDate)
        },
        status: 'confirmed',
        ruStatus: 'Confirmed via webhook',
        bookingSource: this.getBookingSource(reservation.Creator),
        specialRequests: reservation.Comments || ''
      });

      await booking.save();
      console.log('✅ Booking created:', booking.bookingReference);

      // Update cache - mark dates as unavailable
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

      console.log(`✅ Cache updated - ${nights} days marked unavailable for unit ${unit.name}`);

    } catch (error) {
      console.error('❌ Error processing confirmed reservation:', error);
      throw error;
    }
  }

  /**
   * Handle cancellation webhook
   */
  async handleCancellation(data) {
    try {
      const reservationId = data.ReservationID;
      console.log('🚫 Processing cancellation for reservation:', reservationId);

      // Find booking
      const booking = await Booking.findOne({ ruReservationId: reservationId });
      
      if (!booking) {
        console.error(`❌ Booking not found for RU ReservationID: ${reservationId}`);
        return;
      }

      console.log(`✅ Found booking: ${booking.bookingReference}`);

      // Update booking status
      booking.status = 'cancelled';
      booking.ruStatus = 'Cancelled via webhook';
      await booking.save();

      console.log('✅ Booking cancelled:', booking.bookingReference);

      // Update cache - mark dates as available again
      await PropertyDailyCache.updateMany(
        {
          unitId: booking.unitId,
          date: {
            $gte: booking.checkIn,
            $lt: booking.checkOut
          }
        },
        {
          $set: {
            isAvailable: true,
            lastSynced: new Date()
          }
        }
      );

      console.log(`✅ Cache updated - ${booking.nights} days marked available again`);

    } catch (error) {
      console.error('❌ Error processing cancellation:', error);
      throw error;
    }
  }

  /**
   * Determine booking source from Creator field
   */
  getBookingSource(creator) {
    if (!creator) return 'unknown';
    
    const creatorLower = creator.toLowerCase();
    
    if (creatorLower.includes('airbnb')) return 'airbnb';
    if (creatorLower.includes('booking')) return 'booking.com';
    if (creatorLower.includes('expedia')) return 'expedia';
    if (creatorLower.includes('vrbo')) return 'vrbo';
    
    return 'other';
  }
}

const webhookController = new WebhookController();
module.exports = webhookController;
