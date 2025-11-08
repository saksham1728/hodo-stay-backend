# Email Setup Guide for Hodo Stay

## Overview
The booking system now uses secure token-based access with email notifications. Users receive a unique access token via email to view and manage their bookings without needing to create an account.

## Email Configuration

### 1. Gmail Setup (Recommended for Development)

#### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification

#### Step 2: Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Other (Custom name)"
3. Name it "Hodo Stay Backend"
4. Click "Generate"
5. Copy the 16-character password

#### Step 3: Update .env File
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=your-email@gmail.com
FRONTEND_URL=http://localhost:5173
```

### 2. Other Email Providers

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

#### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

## How It Works

### 1. Booking Creation Flow
```
User completes booking
    ↓
Payment verified
    ↓
Booking saved to MongoDB with unique accessToken
    ↓
Email sent with:
  - Booking confirmation details
  - Secure access link: /my-bookings?token=abc123...
    ↓
User receives email
```

### 2. Accessing Bookings
```
User clicks link in email
    ↓
Frontend extracts token from URL
    ↓
API validates token:
  - Token exists?
  - Token not expired? (90 days validity)
    ↓
Returns all bookings for that email
```

### 3. Lost Access Link
```
User goes to /my-bookings
    ↓
Enters email address
    ↓
Clicks "Send Access Link"
    ↓
System finds all bookings for email
    ↓
Sends email with access links
```

## Security Features

### ✅ Token-Based Access
- Each booking gets a unique 64-character hex token
- Tokens are cryptographically secure (crypto.randomBytes)
- Cannot guess or brute-force tokens

### ✅ Email Verification
- Only person with email access can view bookings
- No password needed
- No account creation required

### ✅ Token Expiration
- Tokens expire after 90 days
- Can be extended if needed
- Expired tokens return 401 error

### ✅ No Direct Email Access
- Cannot view bookings by just entering email
- Must have valid token from email
- Prevents unauthorized access

## Email Templates

### 1. Booking Confirmation Email
- Sent immediately after successful booking
- Contains:
  - Booking details
  - Property information
  - Check-in/check-out dates
  - Guest information
  - Payment summary
  - Secure access link
  - Booking details link

### 2. Cancellation Confirmation Email
- Sent when booking is cancelled
- Contains:
  - Cancelled booking details
  - Cancellation date and reason
  - Refund information (if applicable)

### 3. Access Link Email
- Sent when user requests access
- Contains:
  - List of all bookings for that email
  - Individual access links for each booking

## Testing

### Test Email Sending
```bash
# In backend directory
node -e "
const emailService = require('./services/emailService');
const testBooking = {
  bookingReference: 'TEST-001',
  accessToken: 'test-token-123',
  guestInfo: {
    name: 'Test',
    surname: 'User',
    email: 'your-test-email@gmail.com'
  },
  checkIn: new Date(),
  checkOut: new Date(Date.now() + 86400000),
  numberOfGuests: 2,
  numberOfAdults: 2,
  numberOfChildren: 0,
  pricing: {
    alreadyPaid: 5000
  },
  unitId: {
    name: 'Test Property'
  }
};
emailService.sendBookingConfirmation(testBooking)
  .then(() => console.log('✅ Test email sent'))
  .catch(err => console.error('❌ Error:', err));
"
```

## Production Deployment

### Environment Variables
Make sure to set these in your production environment:
```env
SMTP_HOST=your-production-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-production-email
SMTP_PASS=your-production-password
SMTP_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Recommendations
1. **Use a dedicated email service** (SendGrid, AWS SES, Mailgun)
2. **Set up SPF and DKIM records** for better deliverability
3. **Monitor email delivery** and bounce rates
4. **Use a professional domain** (noreply@yourdomain.com)
5. **Implement rate limiting** to prevent abuse

## Troubleshooting

### Email Not Sending
1. Check SMTP credentials in .env
2. Verify app password is correct (for Gmail)
3. Check server logs for errors
4. Test SMTP connection manually

### Email Going to Spam
1. Set up SPF records
2. Set up DKIM signing
3. Use a verified domain
4. Avoid spam trigger words
5. Include unsubscribe link

### Token Not Working
1. Check token hasn't expired (90 days)
2. Verify token in database matches URL
3. Check for typos in token
4. Ensure token is properly URL-encoded

## API Endpoints

### Get Bookings by Token
```
GET /api/bookings/by-token?token=abc123...
```

### Request Access Link
```
POST /api/bookings/request-access
Body: { "email": "user@example.com" }
```

### Cancel Booking
```
POST /api/bookings/:bookingReference/cancel
Body: { "reason": "...", "cancelledBy": "guest" }
```

## Database Schema

### Booking Model - New Fields
```javascript
{
  accessToken: String,        // Unique 64-char hex token
  tokenExpiresAt: Date,       // 90 days from creation
  // ... other fields
}
```

## Support

For issues or questions:
1. Check server logs
2. Verify email configuration
3. Test with a simple email first
4. Contact development team
