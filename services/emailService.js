const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Create transporter using environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    this.fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173' || 'https://hodo-stay.onrender.com';
  }

  /**
   * Send booking confirmation email with access token
   */
  async sendBookingConfirmation(booking) {
    try {
      const accessLink = `${this.frontendUrl}/my-bookings?token=${booking.accessToken}`;
      const confirmationLink = `${this.frontendUrl}/booking-confirmed/${booking.bookingReference}`;

      const mailOptions = {
        from: `"Hodo Stay" <${this.fromEmail}>`,
        to: booking.guestInfo.email,
        subject: `Booking Confirmed - ${booking.bookingReference}`,
        html: this.getBookingConfirmationTemplate(booking, accessLink, confirmationLink)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Booking confirmation email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending booking confirmation email:', error);
      throw error;
    }
  }

  /**
   * Send cancellation confirmation email
   */
  async sendCancellationConfirmation(booking) {
    try {
      const mailOptions = {
        from: `"Hodo Stay" <${this.fromEmail}>`,
        to: booking.guestInfo.email,
        subject: `Booking Cancelled - ${booking.bookingReference}`,
        html: this.getCancellationTemplate(booking)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Cancellation email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending cancellation email:', error);
      throw error;
    }
  }

  /**
   * Send access link email (for users who lost their link)
   */
  async sendAccessLink(email, bookings) {
    try {
      const mailOptions = {
        from: `"Hodo Stay" <${this.fromEmail}>`,
        to: email,
        subject: 'Your Hodo Stay Bookings',
        html: this.getAccessLinkTemplate(email, bookings)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Access link email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending access link email:', error);
      throw error;
    }
  }

  /**
   * Booking confirmation email template
   */
  getBookingConfirmationTemplate(booking, accessLink, confirmationLink) {
    const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; background-color: #FFF7F0; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #2D3A36; color: #ffffff; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 500; }
          .content { padding: 30px; }
          .booking-card { background-color: #FAF2E8; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .booking-detail { margin: 15px 0; }
          .booking-detail strong { color: #2D3A36; }
          .button { display: inline-block; padding: 15px 30px; background-color: #DE754B; color: #ffffff; text-decoration: none; border-radius: 8px; margin: 10px 5px; font-weight: 500; }
          .button:hover { background-color: #c96640; }
          .important-box { background-color: #FFF3CD; border-left: 4px solid: #FFC107; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Booking Confirmed!</h1>
            <p>We're excited to have you stay with us</p>
          </div>
          
          <div class="content">
            <p>Dear ${booking.guestInfo.name} ${booking.guestInfo.surname},</p>
            
            <p>Thank you for booking with Hodo Stay! Your reservation has been confirmed.</p>
            
            <div class="booking-card">
              <h2 style="margin-top: 0; color: #2D3A36;">Booking Details</h2>
              
              <div class="booking-detail">
                <strong>Booking Reference:</strong> ${booking.bookingReference}
              </div>
              
              <div class="booking-detail">
                <strong>Property:</strong> ${booking.unitId?.name || 'Your Property'}
              </div>
              
              <div class="booking-detail">
                <strong>Check-in:</strong> ${checkInDate}
              </div>
              
              <div class="booking-detail">
                <strong>Check-out:</strong> ${checkOutDate}
              </div>
              
              <div class="booking-detail">
                <strong>Guests:</strong> ${booking.numberOfGuests} (${booking.numberOfAdults} Adult${booking.numberOfAdults > 1 ? 's' : ''}${booking.numberOfChildren > 0 ? `, ${booking.numberOfChildren} Child${booking.numberOfChildren > 1 ? 'ren' : ''}` : ''})
              </div>
              
              <div class="booking-detail">
                <strong>Total Amount Paid:</strong> ₹${booking.pricing.alreadyPaid.toLocaleString()}
              </div>
            </div>
            
            <div class="important-box">
              <strong>⚠️ Important:</strong> Save this email! You'll need the link below to view and manage your booking.
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmationLink}" class="button">View Booking Details</a>
              <a href="${accessLink}" class="button">Manage All My Bookings</a>
            </div>
            
            <p><strong>Need to make changes?</strong></p>
            <p>Use the "Manage All My Bookings" link above to view all your bookings and make cancellations if needed.</p>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Looking forward to hosting you!</p>
            <p><strong>The Hodo Stay Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} Hodo Stay. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Cancellation email template
   */
  getCancellationTemplate(booking) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Cancelled</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; background-color: #FFF7F0; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #dc3545; color: #ffffff; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 500; }
          .content { padding: 30px; }
          .booking-card { background-color: #FAF2E8; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Cancelled</h1>
          </div>
          
          <div class="content">
            <p>Dear ${booking.guestInfo.name} ${booking.guestInfo.surname},</p>
            
            <p>Your booking has been successfully cancelled.</p>
            
            <div class="booking-card">
              <h2 style="margin-top: 0; color: #2D3A36;">Cancelled Booking Details</h2>
              
              <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
              <p><strong>Property:</strong> ${booking.unitId?.name || 'Your Property'}</p>
              <p><strong>Cancelled on:</strong> ${new Date(booking.cancellation?.cancelledAt).toLocaleDateString()}</p>
              ${booking.cancellation?.reason ? `<p><strong>Reason:</strong> ${booking.cancellation.reason}</p>` : ''}
            </div>
            
            <p>If you have any questions about your cancellation or refund, please contact us.</p>
            
            <p>We hope to see you again in the future!</p>
            <p><strong>The Hodo Stay Team</strong></p>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Hodo Stay. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Access link email template
   */
  getAccessLinkTemplate(email, bookings) {
    const bookingLinks = bookings.map(booking => {
      const accessLink = `${this.frontendUrl}/my-bookings?token=${booking.accessToken}`;
      return `
        <div style="margin: 15px 0; padding: 15px; background-color: #FAF2E8; border-radius: 8px;">
          <p><strong>${booking.bookingReference}</strong> - ${booking.unitId?.name || 'Property'}</p>
          <p>Check-in: ${new Date(booking.checkIn).toLocaleDateString()}</p>
          <p><a href="${accessLink}" style="color: #DE754B; text-decoration: none;">View & Manage Booking →</a></p>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Booking Access Links</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; background-color: #FFF7F0; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #2D3A36; color: #ffffff; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Hodo Stay Bookings</h1>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            
            <p>Here are your booking access links for ${email}:</p>
            
            ${bookingLinks}
            
            <p>Click on any link above to view and manage that booking.</p>
            
            <p><strong>The Hodo Stay Team</strong></p>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Hodo Stay. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
