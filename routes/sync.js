const express = require('express');
const router = express.Router();
const { Booking, Property, AvailabilityCalendar, SyncLog } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');
const { adminOnly } = require('../middleware/auth');

const xmlParser = new XMLParser();

// POST /api/sync/reservations - Sync reservations from all channels (Admin only)
router.post('/reservations', adminOnly, async (req, res) => {
  const syncLog = new SyncLog({
    syncType: 'reservations_sync',
    triggeredBy: 'manual',
    triggeredByUser: req.user._id
  });
  
  try {
    await syncLog.save();
    
    const { 
      dateFrom, 
      dateTo,
      locationId = 0 
    } = req.body;
    
    // Default to last 24 hours if no dates provided
    const defaultDateFrom = dateFrom || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const defaultDateTo = dateTo || new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    console.log(`Syncing reservations from ${defaultDateFrom} to ${defaultDateTo}`);
    
    syncLog.config = {
      dateFrom: defaultDateFrom,
      dateTo: defaultDateTo,
      locationId
    };
    await syncLog.save();
    
    const xmlResponse = await ruClient.pullListReservations(
      defaultDateFrom, 
      defaultDateTo, 
      locationId
    );
    const parsedResponse = xmlParser.parse(xmlResponse);
    
    // Check for errors
    if (parsedResponse.error) {
      await syncLog.markFailed(new Error(`API Error: ${parsedResponse.error}`));
      return res.status(400).json({
        success: false,
        error: parsedResponse.error,
        message: 'Error syncing reservations from Rentals United'
      });
    }
    
    // Extract reservations from response
    const reservations = parsedResponse?.Pull_ListReservations_RS?.Reservations?.Reservation || [];
    const reservationsArray = Array.isArray(reservations) ? reservations : [reservations];
    
    const syncResults = {
      totalFound: reservationsArray.length,
      newBookings: 0,
      updatedBookings: 0,
      cancelledBookings: 0,
      conflicts: []
    };
    
    // Process each reservation
    for (const reservation of reservationsArray) {
      try {
        const ruReservationId = reservation.ReservationID;
        const statusId = reservation.StatusID;
        
        // Find existing booking
        const existingBooking = await Booking.findOne({ ruReservationId });
        
        if (existingBooking) {
          // Update existing booking
          let statusUpdate = {};
          
          if (statusId === '1') { // Confirmed
            statusUpdate.status = 'ru_confirmed';
          } else if (statusId === '2') { // Cancelled
            statusUpdate.status = 'cancelled';
            statusUpdate['cancellation.cancelledAt'] = new Date();
            statusUpdate['cancellation.cancelledBy'] = 'system';
            statusUpdate['cancellation.reason'] = 'Cancelled via channel';
            
            // Unblock dates
            if (existingBooking.ruPropertyId) {
              await AvailabilityCalendar.unblockDates(
                existingBooking.ruPropertyId,
                existingBooking.checkIn,
                existingBooking.checkOut
              );
            }
            
            syncResults.cancelledBookings++;
          }
          
          if (Object.keys(statusUpdate).length > 0) {
            await Booking.updateOne({ _id: existingBooking._id }, statusUpdate);
            syncResults.updatedBookings++;
          }
        } else {
          // New reservation from external channel
          if (statusId === '1' && reservation.StayInfos?.StayInfo) {
            const stayInfo = Array.isArray(reservation.StayInfos.StayInfo) 
              ? reservation.StayInfos.StayInfo[0] 
              : reservation.StayInfos.StayInfo;
            
            const propertyId = stayInfo.PropertyID;
            const checkIn = new Date(stayInfo.DateFrom);
            const checkOut = new Date(stayInfo.DateTo);
            
            // Find property in our database
            const property = await Property.findOne({ ruPropertyId: propertyId });
            
            if (property) {
              // Block dates in availability calendar
              await AvailabilityCalendar.blockDates(
                propertyId,
                checkIn,
                checkOut,
                'external_booking'
              );
              
              // Update availability calendar with reservation details
              const dates = [];
              const currentDate = new Date(checkIn);
              
              while (currentDate < checkOut) {
                dates.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
              }
              
              await AvailabilityCalendar.bulkWrite(
                dates.map(date => ({
                  updateOne: {
                    filter: { ruPropertyId: propertyId, date },
                    update: {
                      $set: {
                        isAvailable: false,
                        isBooked: true,
                        bookingSource: 'other',
                        'reservationDetails.ruReservationId': ruReservationId,
                        'reservationDetails.checkIn': checkIn,
                        'reservationDetails.checkOut': checkOut,
                        'reservationDetails.numberOfGuests': stayInfo.NumberOfGuests,
                        lastSyncedAt: new Date()
                      }
                    },
                    upsert: true
                  }
                }))
              );
              
              syncResults.newBookings++;
            }
          }
        }
        
        syncLog.details.processedRecords++;
      } catch (error) {
        console.error(`Error processing reservation ${reservation.ReservationID}:`, error);
        await syncLog.addError('reservation_processing', error.message, reservation.ReservationID);
      }
    }
    
    await syncLog.markCompleted({
      reservationsProcessed: syncResults.totalFound,
      newRecords: syncResults.newBookings,
      updatedRecords: syncResults.updatedBookings
    });
    
    res.json({
      success: true,
      data: {
        syncResults,
        syncTimestamp: new Date().toISOString(),
        syncLogId: syncLog._id
      },
      message: 'Reservation sync completed successfully'
    });
    
  } catch (error) {
    console.error('Error in sync reservations:', error);
    await syncLog.markFailed(error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /api/sync/status - Get sync status
router.get('/status', adminOnly, async (req, res) => {
  try {
    // Get latest sync logs
    const latestSyncs = await Promise.all([
      SyncLog.getLatestSync('properties_sync'),
      SyncLog.getLatestSync('reservations_sync'),
      SyncLog.getLatestSync('availability_sync')
    ]);
    
    // Get sync statistics for last 7 days
    const syncStats = await SyncLog.getSyncStats(7);
    
    res.json({
      success: true,
      data: {
        lastSync: new Date().toISOString(),
        channels: [
          { 
            name: 'Airbnb', 
            status: 'connected', 
            lastSync: latestSyncs[1]?.startedAt || null,
            syncStatus: latestSyncs[1]?.status || 'unknown'
          },
          { 
            name: 'Booking.com', 
            status: 'connected', 
            lastSync: latestSyncs[1]?.startedAt || null,
            syncStatus: latestSyncs[1]?.status || 'unknown'
          },
          { 
            name: 'Direct Bookings', 
            status: 'active', 
            lastSync: new Date().toISOString(),
            syncStatus: 'active'
          }
        ],
        rentalsUnited: {
          status: 'connected',
          endpoint: process.env.RU_BASE_URL,
          locationId: process.env.RU_LOCATION_ID
        },
        latestSyncs: {
          properties: latestSyncs[0],
          reservations: latestSyncs[1],
          availability: latestSyncs[2]
        },
        statistics: syncStats
      }
    });
    
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /api/sync/logs - Get sync logs (Admin only)
router.get('/logs', adminOnly, async (req, res) => {
  try {
    const { 
      syncType, 
      status, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = {};
    if (syncType) query.syncType = syncType;
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const logs = await SyncLog.find(query)
      .populate('triggeredByUser', 'firstName lastName email')
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const totalLogs = await SyncLog.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalLogs / limit),
          totalLogs,
          hasNext: page * limit < totalLogs,
          hasPrev: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting sync logs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;