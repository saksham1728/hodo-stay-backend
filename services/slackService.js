const { WebClient } = require('@slack/web-api');
const fetch = require('node-fetch');

class SlackService {
  constructor() {
    this.client = null;
    this.channelId = process.env.SLACK_CHANNEL_ID;
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    // Initialize Slack client if bot token is provided
    if (process.env.SLACK_BOT_TOKEN) {
      this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
      console.log('✅ Slack service initialized with Bot Token');
    } else if (this.webhookUrl) {
      console.log('✅ Slack service initialized with Webhook URL');
    } else {
      console.log('⚠️  Slack not configured - notifications disabled');
    }
  }

  /**
   * Send booking notification to Slack channel
   * @param {Object} booking - Booking object from MongoDB
   */
  async sendBookingNotification(booking) {
    // Skip if Slack is not configured
    if (!this.client && !this.webhookUrl) {
      console.log('⚠️  Slack not configured - skipping notification');
      return { success: false, message: 'Slack not configured' };
    }

    try {
      const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      
      const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      // Format pricing information
      const originalPrice = booking.pricing.originalPrice || booking.pricing.priceBeforeGST;
      const discountAmount = booking.pricing.discountAmount || 0;
      const gstAmount = booking.pricing.gstAmount || 0;
      const finalPrice = booking.pricing.finalPriceWithGST || booking.pricing.clientPrice;

      // Build pricing details text
      let pricingText = `*Pricing Breakdown:*\n`;
      pricingText += `• Original Price: ₹${originalPrice.toLocaleString('en-IN')}\n`;
      
      if (discountAmount > 0) {
        pricingText += `• Discount (${booking.appliedCoupon}): -₹${discountAmount.toLocaleString('en-IN')}\n`;
        pricingText += `• Price After Discount: ₹${booking.pricing.priceBeforeGST.toLocaleString('en-IN')}\n`;
      }
      
      pricingText += `• GST (${booking.pricing.gstRate}%): +₹${gstAmount.toLocaleString('en-IN')}\n`;
      pricingText += `• *Total Paid: ₹${finalPrice.toLocaleString('en-IN')}*`;

      // Create rich message with blocks
      const message = {
        channel: this.channelId,
        text: `🎉 New Booking Confirmed! ${booking.bookingReference}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🎉 New Booking Confirmed!',
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Booking Reference:*\n${booking.bookingReference}`
              },
              {
                type: 'mrkdwn',
                text: `*RU Reservation ID:*\n${booking.ruReservationId || 'Pending'}`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Guest Name:*\n${booking.guestInfo.name} ${booking.guestInfo.surname}`
              },
              {
                type: 'mrkdwn',
                text: `*Email:*\n${booking.guestInfo.email}`
              },
              {
                type: 'mrkdwn',
                text: `*Phone:*\n${booking.guestInfo.phone}`
              },
              {
                type: 'mrkdwn',
                text: `*Guests:*\n${booking.numberOfGuests} (${booking.numberOfAdults} adults, ${booking.numberOfChildren} children)`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Check-in:*\n${checkInDate}`
              },
              {
                type: 'mrkdwn',
                text: `*Check-out:*\n${checkOutDate}`
              },
              {
                type: 'mrkdwn',
                text: `*Nights:*\n${booking.nights}`
              },
              {
                type: 'mrkdwn',
                text: `*Status:*\n✅ ${booking.status.toUpperCase()}`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: pricingText
            }
          }
        ]
      };

      // Add special requests if any
      if (booking.specialRequests) {
        message.blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Special Requests:*\n${booking.specialRequests}`
          }
        });
      }

      // Add property info if available
      if (booking.unitId) {
        const unitName = booking.unitId.name || booking.unitId.internalName || 'N/A';
        message.blocks.push({
          type: 'divider'
        });
        message.blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Property:*\n${unitName}`
            },
            {
              type: 'mrkdwn',
              text: `*Property ID:*\n${booking.ruPropertyId}`
            }
          ]
        });
      }

      // Send message to Slack using webhook or bot token
      if (this.webhookUrl) {
        // Use webhook URL (simpler method)
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });

        if (response.ok) {
          console.log('✅ Slack notification sent successfully via webhook');
          return { success: true, method: 'webhook' };
        } else {
          const errorText = await response.text();
          throw new Error(`Webhook failed: ${errorText}`);
        }
      } else if (this.client && this.channelId) {
        // Use bot token method
        message.channel = this.channelId;
        const result = await this.client.chat.postMessage(message);
        console.log('✅ Slack notification sent successfully via bot token:', result.ts);
        return { success: true, messageId: result.ts, method: 'bot' };
      }

    } catch (error) {
      console.error('❌ Error sending Slack notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a simple text notification to Slack
   * @param {string} text - Message text
   */
  async sendSimpleNotification(text) {
    if (!this.client && !this.webhookUrl) {
      console.log('⚠️  Slack not configured - skipping notification');
      return { success: false, message: 'Slack not configured' };
    }

    try {
      if (this.webhookUrl) {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (response.ok) {
          console.log('✅ Slack notification sent via webhook');
          return { success: true, method: 'webhook' };
        } else {
          const errorText = await response.text();
          throw new Error(`Webhook failed: ${errorText}`);
        }
      } else if (this.client && this.channelId) {
        const result = await this.client.chat.postMessage({
          channel: this.channelId,
          text: text
        });
        console.log('✅ Slack notification sent via bot token:', result.ts);
        return { success: true, messageId: result.ts, method: 'bot' };
      }

    } catch (error) {
      console.error('❌ Error sending Slack notification:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const slackService = new SlackService();
module.exports = slackService;
