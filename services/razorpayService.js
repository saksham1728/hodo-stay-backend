const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance with credentials from environment
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

class RazorpayService {
  /**
   * Create a Razorpay order for payment
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Razorpay order
   */
  async createOrder(orderData) {
    try {
      const { amount, currency = 'USD', receipt, notes = {} } = orderData;

      // Razorpay expects amount in smallest currency unit (paise for INR, cents for USD)
      const amountInSmallestUnit = Math.round(amount * 100);

      const options = {
        amount: amountInSmallestUnit,
        currency: currency,
        receipt: receipt,
        notes: notes,
        payment_capture: 1 // Auto capture payment
      };

      console.log('Creating Razorpay order:', options);

      const order = await razorpay.orders.create(options);
      
      console.log('Razorpay order created:', order.id);

      return {
        success: true,
        order: order
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify Razorpay payment signature
   * This is critical for security - prevents payment tampering
   * @param {Object} paymentData - Payment verification data
   * @returns {Boolean} Whether signature is valid
   */
  verifyPaymentSignature(paymentData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

      // Create signature using order_id and payment_id
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');

      // Compare signatures
      const isValid = generated_signature === razorpay_signature;

      if (isValid) {
        console.log('✅ Payment signature verified successfully');
      } else {
        console.error('❌ Payment signature verification failed');
        console.error('Expected:', generated_signature);
        console.error('Received:', razorpay_signature);
      }

      return isValid;
    } catch (error) {
      console.error('Error verifying payment signature:', error);
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   * @param {String} paymentId - Razorpay payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return {
        success: true,
        payment: payment
      };
    } catch (error) {
      console.error('Error fetching payment details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Initiate refund for a payment
   * @param {String} paymentId - Razorpay payment ID
   * @param {Number} amount - Amount to refund (optional, full refund if not provided)
   * @returns {Promise<Object>} Refund details
   */
  async initiateRefund(paymentId, amount = null) {
    try {
      const refundData = {
        payment_id: paymentId
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to smallest unit
      }

      const refund = await razorpay.payments.refund(paymentId, refundData);
      
      console.log('Refund initiated:', refund.id);

      return {
        success: true,
        refund: refund
      };
    } catch (error) {
      console.error('Error initiating refund:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify webhook signature for Razorpay webhooks
   * @param {String} webhookBody - Raw webhook body
   * @param {String} webhookSignature - Signature from Razorpay
   * @returns {Boolean} Whether webhook is valid
   */
  verifyWebhookSignature(webhookBody, webhookSignature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(webhookBody)
        .digest('hex');

      return expectedSignature === webhookSignature;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}

module.exports = new RazorpayService();
