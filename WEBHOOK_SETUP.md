# RU Webhook Setup Guide

This guide explains how to set up and test the Rentals United webhook system for receiving external bookings from Airbnb, Booking.com, etc.

## Overview

The webhook system automatically:
1. Receives booking notifications from Rentals United
2. Creates bookings in your MongoDB database
3. Updates PropertyDailyCache to mark dates as unavailable
4. Handles cancellations by marking dates available again

## Setup Steps

### 1. Local Testing with ngrok

For development/testing, use ngrok to expose your localhost:

```bash
# Install ngrok
npm install -g ngrok

# Start your backend
npm start  # Running on localhost:5000

# In another terminal, expose it
ngrok http 5000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 2. Register Webhook with RU

```bash
# Register webhook
node scripts/register-webhook.js https://abc123.ngrok.io/api/webhooks/rentals-united

# For production
node scripts/register-webhook.js https://api.hodostays.com/api/webhooks/rentals-united
```

This will:
- Register your webhook URL with RU
- Return a Hash for authentication
- Automatically add `RU_WEBHOOK_HASH` to your `.env` file

### 3. Update .env File

Make sure your `.env` has:

```env
RU_WEBHOOK_HASH=1X7J9SALRDJ283FMY8PFO8BIGBTEZ5J68WGNEGZW
```

### 4. Restart Server

```bash
npm start
```

## Testing

### Test with Sample Data

```bash
node scripts/test-webhook.js
```

This sends a sample booking to your webhook endpoint.

### Test with Real Booking

1. Go to RU dashboard
2. Create a test booking manually
3. RU will send webhook to your endpoint
4. Check your MongoDB for the new booking
5. Check PropertyDailyCache - dates should be marked unavailable

## Webhook Types

The system handles:

### 1. Confirmed Reservations
- **Type**: `LNM_PutConfirmedReservation_RQ`
- **Action**: Creates booking, marks dates unavailable
- **Sources**: Airbnb, Booking.com, Expedia, direct bookings

### 2. Cancellations
- **Type**: `LNM_CancelReservation_RQ`
- **Action**: Updates booking status, marks dates available again

### 3. Unconfirmed Reservations (Ignored for now)
- **Type**: `LNM_PutUnconfirmedReservation_RQ`
- **Action**: Logged but not processed

### 4. Leads (Ignored for now)
- **Type**: `LNM_PutLeadReservation_RQ`
- **Action**: Logged but not processed

## How It Works

### Confirmed Reservation Flow

```
Airbnb booking created
↓
RU receives booking
↓
RU sends webhook: POST /api/webhooks/rentals-united
↓
Your system:
  1. Validates hash
  2. Parses XML
  3. Finds unit by PropertyID
  4. Creates booking in MongoDB
  5. Updates PropertyDailyCache (isAvailable = false)
  6. Returns 200 OK
```

### Cancellation Flow

```
Booking cancelled in RU
↓
RU sends webhook: POST /api/webhooks/rentals-united
↓
Your system:
  1. Validates hash
  2. Finds booking by ruReservationId
  3. Updates status to 'cancelled'
  4. Updates PropertyDailyCache (isAvailable = true)
  5. Returns 200 OK
```

## Monitoring

### Check Webhook Logs

```bash
# Your server logs will show:
📥 RU Webhook received
Webhook Type: LNM_PutConfirmedReservation_RQ
✅ Webhook authenticated
📋 Processing confirmed reservation: 145526061
✅ Found unit: HSR0301-301
✅ Booking created: HODO-20260220-5699
✅ Cache updated - 2 days marked unavailable
```

### Verify in Database

```javascript
// Check booking was created
db.bookings.find({ ruReservationId: 145526061 })

// Check cache was updated
db.propertydailycaches.find({
  unitId: ObjectId("..."),
  date: { $gte: ISODate("2026-03-25"), $lt: ISODate("2026-03-27") }
})
```

## Troubleshooting

### Webhook Not Receiving Data

1. Check ngrok is running: `ngrok http 5000`
2. Check webhook URL is registered: `node scripts/register-webhook.js <url>`
3. Check RU_WEBHOOK_HASH in .env
4. Check server logs for errors

### Authentication Failed

- Make sure `RU_WEBHOOK_HASH` in .env matches the hash from registration
- Re-register webhook if needed

### Unit Not Found

- Check PropertyID in webhook matches ruPropertyId in your Unit collection
- Run unit sync: `node scripts/sync-units.js`

### Cache Not Updating

- Check PropertyDailyCache has records for those dates
- Run cache sync: `POST /api/pricing/sync`

## Unregister Webhook

To stop receiving webhooks:

```bash
node scripts/unregister-webhook.js
```

## Production Deployment

1. Deploy backend to production server
2. Get production HTTPS URL (e.g., `https://api.hodostays.com`)
3. Register webhook with production URL
4. Add `RU_WEBHOOK_HASH` to production environment variables
5. Monitor logs for incoming webhooks

## Security

- Webhooks are validated using the Hash from RU
- Only HTTPS URLs are accepted by RU
- Invalid authentication returns 401
- All webhook data is logged for debugging

## Support

For issues:
1. Check server logs
2. Check MongoDB for booking/cache records
3. Test with `node scripts/test-webhook.js`
4. Contact RU support if webhooks not being sent
