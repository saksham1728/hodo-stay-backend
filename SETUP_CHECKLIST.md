# Hodo Stay Backend - Setup Checklist

## 📋 Required Environment Variables

### ✅ Already Configured
- [x] `MONGODB_URI` - Database connection
- [x] `RU_USERNAME` - Rentals United username
- [x] `RU_PASSWORD` - Rentals United password
- [x] `PORT` - Server port (5000)
- [x] `NODE_ENV` - Environment (development)
- [x] `TAX_RATE` - Tax rate (0.12)
- [x] `FRONTEND_URL` - Frontend URL (http://localhost:5173)

### ⚠️ Need to Update

#### 1. Razorpay Payment Gateway
**Where to get:**
1. Go to https://dashboard.razorpay.com/
2. Sign up or log in
3. Navigate to Settings → API Keys
4. Generate Test/Live keys

**Update in `.env`:**
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

#### 2. Email Configuration (SMTP)
**For Gmail (Recommended for Development):**

**Step 1: Enable 2-Factor Authentication**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification

**Step 2: Generate App Password**
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Other (Custom name)"
3. Name it "Hodo Stay Backend"
4. Click "Generate"
5. Copy the 16-character password (no spaces)

**Update in `.env`:**
```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # 16-char app password
SMTP_FROM=Hodo Stay <your-email@gmail.com>
```

**Alternative Email Providers:**

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

## 🧪 Testing Setup

### 1. Test Database Connection
```bash
cd hodo-stay-backend
npm run dev
```
Look for: `✅ MongoDB connected successfully`

### 2. Test Email Sending
Create a test file `test-email.js`:
```javascript
require('dotenv').config();
const emailService = require('./services/emailService');

const testBooking = {
  bookingReference: 'TEST-001',
  accessToken: 'test-token-123',
  guestInfo: {
    name: 'Test',
    surname: 'User',
    email: 'your-test-email@gmail.com'  // Use your email
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
  .then(() => {
    console.log('✅ Test email sent successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error sending email:', err);
    process.exit(1);
  });
```

Run test:
```bash
node test-email.js
```

### 3. Test Razorpay Integration
```bash
# Start backend
npm run dev

# In another terminal, test payment endpoint
curl -X POST http://localhost:5000/api/payments/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "bookingData": {
      "unitId": "test-unit-id",
      "checkIn": "2024-12-01",
      "checkOut": "2024-12-03"
    }
  }'
```

## 🚀 Production Deployment Checklist

### Before Deploying:
- [ ] Update `NODE_ENV=production`
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Use Razorpay LIVE keys (not test keys)
- [ ] Use production email service (SendGrid/AWS SES)
- [ ] Set up proper domain for emails (noreply@yourdomain.com)
- [ ] Configure SPF and DKIM records for email domain
- [ ] Set up SSL/TLS certificates
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy for MongoDB
- [ ] Set up error tracking (Sentry, etc.)

### Security:
- [ ] Never commit `.env` file
- [ ] Use environment variables in hosting platform
- [ ] Rotate secrets regularly
- [ ] Enable MongoDB IP whitelist
- [ ] Use strong passwords
- [ ] Enable CORS only for your domain
- [ ] Set up firewall rules

## 📝 Common Issues & Solutions

### Issue: Email not sending
**Solution:**
1. Check SMTP credentials are correct
2. For Gmail, ensure 2FA is enabled and using App Password
3. Check server logs for specific error
4. Test SMTP connection manually

### Issue: "Invalid signature" error in Razorpay
**Solution:**
1. Verify `RAZORPAY_KEY_SECRET` is correct
2. Check if using test/live keys consistently
3. Ensure webhook secret matches

### Issue: MongoDB connection failed
**Solution:**
1. Check MongoDB URI is correct
2. Verify IP whitelist in MongoDB Atlas
3. Check network connectivity
4. Verify username/password

### Issue: Token expired
**Solution:**
- Tokens expire after 90 days
- User can request new access link via email
- Check `tokenExpiresAt` field in database

## 🔗 Useful Links

- **Razorpay Dashboard:** https://dashboard.razorpay.com/
- **Gmail App Passwords:** https://myaccount.google.com/apppasswords
- **MongoDB Atlas:** https://cloud.mongodb.com/
- **Rentals United API Docs:** https://rentalsunited.com/api/
- **Nodemailer Docs:** https://nodemailer.com/

## 📞 Support

If you encounter issues:
1. Check server logs: `npm run dev`
2. Review this checklist
3. Check `EMAIL_SETUP_GUIDE.md` for detailed email setup
4. Contact development team

## ✅ Final Verification

Before going live, verify:
- [ ] Can create a booking successfully
- [ ] Receive confirmation email with access link
- [ ] Can access bookings via token link
- [ ] Can cancel booking
- [ ] Receive cancellation email
- [ ] Can request new access link
- [ ] Payment gateway working
- [ ] All emails look professional
- [ ] Links in emails work correctly
- [ ] Mobile responsive emails
