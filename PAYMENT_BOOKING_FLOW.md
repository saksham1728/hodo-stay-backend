# Payment & Booking Flow Documentation

## Overview

Complete payment and booking integration with Razorpay and Rentals United API.

---

## Flow Diagram

```
User Journey:
1. Select unit + dates → Get pricing
2. Fill booking form
3. Pay via Razorpay
4. Payment success → Create RU reservation
5. Save booking in MongoDB
6. Show confirmation
```

---

## APIs Implemented

### Payment APIs

#### 1. Create Payment Order
**Endpoint**: `POST /api/payments/create-order`

**Request**:
```json
{
  "amount": 28000,
  "currency": "INR",
  "bookingData": {
    "unitId": "68fb4285f33612db82abbe2d",
    "checkIn": "2025-12-01",
    "checkOut": "2025-12-05"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "orderId": "order_xyz123",
    "amount": 2800000,
    "currency": "INR",
    "key": "rzp_test_xxxxx"
  }
}
```

#### 2. Verify Payment & Create Booking
**Endpoint**: `POST /api/payments/verify`

**Request**:
```json
{
  "razorpay_order_id": "order_xyz123",
  "razorpay_payment_id": "pay_abc456",
  "razorpay_signature": "signature_hash",
  "bookingData": {
    "unitId": "68fb4285f33612db82abbe2d",
    "checkIn": "2025-12-01",
    "checkOut": "2025-12-05",
    "numberOfGuests": 2,
    "numberOfAdults": 2,
    "numberOfChildren": 0,
    "guestInfo": {
      "name": "John",
      "surname": "Doe",
      "email": "john@example.com",
      "phone": "+91 9876543210",
      "address": "123 Street",
      "zipCode": "560102"
    },
    "pricing": {
      "ruPrice": 28000,
      "clientPrice": 28000,
      "currency": "INR"
    },
    "specialRequests": "Early check-in if possible"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payment verified and booking confirmed",
  "data": {
    "booking": {
      "bookingReference": "HODO-20251201-1234",
      "ruReservationId": 789456,
      "status": "confirmed",
      "checkIn": "2025-12-01",
      "checkOut": "2025-12-05",
      "nights": 4,
      "guestInfo": {...},
      "pricing": {...},
      "unit": {...}
    }
  }
}
```

### Booking APIs

#### 1. Get Booking by Reference
**Endpoint**: `GET /api/bookings/reference/:bookingReference`

**Response**:
```json
{
  "success": true,
  "data": {
    "booking": {
      "bookingReference": "HODO-20251201-1234",
      "ruReservationId": 789456,
      "status": "confirmed",
      "checkIn": "2025-12-01",
      "checkOut": "2025-12-05",
      "nights": 4,
      "guestInfo": {...},
      "pricing": {...},
      "payment": {...},
      "unitId": {...},
      "buildingId": {...}
    }
  }
}
```

#### 2. Get Bookings by Email
**Endpoint**: `GET /api/bookings/email?email=john@example.com`

**Response**:
```json
{
  "success": true,
  "data": {
    "bookings": [...]
  }
}
```

#### 3. Cancel Booking
**Endpoint**: `POST /api/bookings/:bookingReference/cancel`

**Request**:
```json
{
  "reason": "Change of plans",
  "cancelledBy": "guest"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "booking": {...}
  }
}
```

---

## Database Schema

### Booking Model

```javascript
{
  bookingReference: "HODO-20251201-1234",
  ruReservationId: 789456,
  userId: ObjectId (optional),
  buildingId: ObjectId,
  unitId: ObjectId,
  ruPropertyId: 4017810,
  checkIn: Date,
  checkOut: Date,
  nights: 4,
  guestInfo: {
    name: "John",
    surname: "Doe",
    email: "john@example.com",
    phone: "+91 9876543210",
    address: "123 Street",
    zipCode: "560102"
  },
  numberOfGuests: 2,
  numberOfAdults: 2,
  numberOfChildren: 0,
  numberOfInfants: 0,
  pricing: {
    ruPrice: 28000,
    clientPrice: 28000,
    alreadyPaid: 28000,
    currency: "INR"
  },
  payment: {
    paymentId: "pay_abc456",
    orderId: "order_xyz123",
    signature: "signature_hash",
    status: "completed",
    method: "razorpay",
    paidAt: Date
  },
  status: "confirmed",
  ruStatus: "Success",
  cancellation: {
    cancelledAt: Date,
    cancelledBy: "guest",
    reason: "Change of plans",
    refundAmount: 0,
    refundStatus: "pending"
  },
  specialRequests: "Early check-in",
  createdAt: Date,
  updatedAt: Date
}
```

---

## Rentals United Integration

### Create Confirmed Reservation

**RU API**: `Push_PutConfirmedReservationMulti_RQ`

**XML Request**:
```xml
<Push_PutConfirmedReservationMulti_RQ>
  <Authentication>
    <UserName>username</UserName>
    <Password>password</Password>
  </Authentication>
  <Reservation>
    <StayInfos>
      <StayInfo>
        <PropertyID>4017810</PropertyID>
        <DateFrom>2025-12-01</DateFrom>
        <DateTo>2025-12-05</DateTo>
        <NumberOfGuests>2</NumberOfGuests>
        <Costs>
          <RUPrice>28000.00</RUPrice>
          <ClientPrice>28000.00</ClientPrice>
          <AlreadyPaid>28000.00</AlreadyPaid>
          <ChannelCommission>0.00</ChannelCommission>
        </Costs>
      </StayInfo>
    </StayInfos>
    <CustomerInfo>
      <Name>John</Name>
      <SurName>Doe</SurName>
      <Email>john@example.com</Email>
      <Phone>+91 9876543210</Phone>
      <Address>123 Street</Address>
      <ZipCode>560102</ZipCode>
    </CustomerInfo>
    <GuestDetailsInfo>
      <NumberOfAdults>2</NumberOfAdults>
      <NumberOfChildren>0</NumberOfChildren>
    </GuestDetailsInfo>
    <Comments>Early check-in if possible</Comments>
  </Reservation>
</Push_PutConfirmedReservationMulti_RQ>
```

**XML Response**:
```xml
<Push_PutConfirmedReservationMulti_RS>
  <Status ID="0">Success</Status>
  <ResponseID>uuid</ResponseID>
  <ReservationID>789456</ReservationID>
</Push_PutConfirmedReservationMulti_RS>
```

### Cancel Reservation

**RU API**: `Push_CancelReservation_RQ`

**XML Request**:
```xml
<Push_CancelReservation_RQ>
  <Authentication>
    <UserName>username</UserName>
    <Password>password</Password>
  </Authentication>
  <ReservationID>789456</ReservationID>
  <CancelTypeID>2</CancelTypeID>
</Push_CancelReservation_RQ>
```

---

## Razorpay Integration

### Setup

1. Sign up at https://razorpay.com
2. Get API keys from Dashboard
3. Add to `.env`:
```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Frontend Integration

```javascript
// 1. Create order
const orderResponse = await fetch('/api/payments/create-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 28000,
    currency: 'INR',
    bookingData: {...}
  })
});

const { orderId, amount, currency, key } = await orderResponse.json();

// 2. Open Razorpay checkout
const options = {
  key: key,
  amount: amount,
  currency: currency,
  order_id: orderId,
  name: 'Hodo Stay',
  description: 'Property Booking',
  handler: async function (response) {
    // 3. Verify payment
    const verifyResponse = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        bookingData: {...}
      })
    });
    
    const result = await verifyResponse.json();
    // Show success page with booking details
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

---

## Testing

### Test Payment Flow

```bash
# 1. Create order
curl -X POST http://localhost:5000/api/payments/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 28000,
    "currency": "INR",
    "bookingData": {
      "unitId": "68fb4285f33612db82abbe2d",
      "checkIn": "2025-12-01",
      "checkOut": "2025-12-05"
    }
  }'

# 2. Use Razorpay test cards
# Card: 4111 1111 1111 1111
# CVV: Any 3 digits
# Expiry: Any future date

# 3. Check booking
curl http://localhost:5000/api/bookings/reference/HODO-20251201-1234
```

---

## Environment Variables

```env
# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Rentals United
RU_USERNAME=your_ru_username
RU_PASSWORD=your_ru_password

# MongoDB
MONGODB_URI=mongodb+srv://...
```

---

## Next Steps

1. ✅ Payment integration (Razorpay)
2. ✅ Booking creation
3. ✅ RU reservation creation
4. ✅ Booking cancellation
5. 🔄 User authentication (later)
6. 🔄 Email notifications (later)
7. 🔄 Refund processing (later)

---

**Version**: 1.0  
**Last Updated**: November 1, 2025
