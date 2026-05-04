/**
 * Booking Repository
 * 
 * Data access layer for bookings using Supabase
 * Provides Mongoose-like interface for backward compatibility
 */

const { getSupabaseClient, DatabaseError, NotFoundError } = require('../db/supabaseClient');
const { transformBooking, transformArray } = require('../utils/responseTransformers');
const crypto = require('crypto');

class BookingRepository {
  constructor() {
    this.tableName = 'ho_bookings';
    this.supabase = getSupabaseClient();
  }

  /**
   * Generate booking reference
   * Format: HODO-YYYYMMDD-XXXX
   */
  generateBookingReference() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `HODO-${dateStr}-${random}`;
  }

  /**
   * Generate secure access token
   */
  generateAccessToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calculate token expiration date (90 days from now)
   */
  getTokenExpiration() {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);
    return expiryDate.toISOString();
  }

  /**
   * Find booking by ID
   * @param {string} id - Booking ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Booking object
   */
  async findById(id, options = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id);

      // Handle populate for unitId
      if (options.populate && options.populate.includes('unitId')) {
        query = this.supabase
          .from(this.tableName)
          .select('*, ho_units!unit_id(*), ho_buildings!building_id(*)')
          .eq('id', id);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Booking not found');
        }
        throw new DatabaseError('Failed to fetch booking', error);
      }

      return transformBooking(data);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to fetch booking by ID', error);
    }
  }

  /**
   * Find one booking by query
   * @param {Object} query - Query object
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Booking object
   */
  async findOne(query, options = {}) {
    try {
      let supabaseQuery = this.supabase.from(this.tableName).select('*');

      // Handle populate
      if (options.populate) {
        supabaseQuery = this.supabase
          .from(this.tableName)
          .select('*, ho_units!unit_id(*), ho_buildings!building_id(*)');
      }

      // Apply filters
      if (query.bookingReference) {
        supabaseQuery = supabaseQuery.eq('booking_reference', query.bookingReference);
      }
      if (query.accessToken) {
        supabaseQuery = supabaseQuery.eq('access_token', query.accessToken);
      }
      if (query.ruReservationId) {
        supabaseQuery = supabaseQuery.eq('ru_reservation_id', query.ruReservationId);
      }
      if (query['guestInfo.email']) {
        supabaseQuery = supabaseQuery.eq('guest_info->>email', query['guestInfo.email']);
      }

      const { data, error } = await supabaseQuery.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new DatabaseError('Failed to fetch booking', error);
      }

      return transformBooking(data);
    } catch (error) {
      throw new DatabaseError('Failed to find booking', error);
    }
  }

  /**
   * Find multiple bookings by query
   * @param {Object} query - Query object
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of booking objects
   */
  async find(query = {}, options = {}) {
    try {
      let supabaseQuery = this.supabase.from(this.tableName).select('*');

      // Handle populate
      if (options.populate) {
        supabaseQuery = this.supabase
          .from(this.tableName)
          .select('*, ho_units!unit_id(*), ho_buildings!building_id(*)');
      }

      // Apply filters
      if (query.status) {
        supabaseQuery = supabaseQuery.eq('status', query.status);
      }
      if (query.userId) {
        supabaseQuery = supabaseQuery.eq('user_id', query.userId);
      }
      if (query['guestInfo.email']) {
        supabaseQuery = supabaseQuery.eq('guest_info->>email', query['guestInfo.email']);
      }

      // Apply sorting
      if (options.sort) {
        const sortField = Object.keys(options.sort)[0];
        const sortOrder = options.sort[sortField] === -1 ? 'desc' : 'asc';
        const pgField = sortField === 'createdAt' ? 'created_at' : sortField;
        supabaseQuery = supabaseQuery.order(pgField, { ascending: sortOrder === 'asc' });
      }

      // Apply pagination
      if (options.skip !== undefined) {
        supabaseQuery = supabaseQuery.range(options.skip, options.skip + (options.limit || 10) - 1);
      } else if (options.limit) {
        supabaseQuery = supabaseQuery.limit(options.limit);
      }

      const { data, error } = await supabaseQuery;

      if (error) {
        throw new DatabaseError('Failed to fetch bookings', error);
      }

      return transformArray(data || [], transformBooking);
    } catch (error) {
      throw new DatabaseError('Failed to find bookings', error);
    }
  }

  /**
   * Create a new booking
   * @param {Object} bookingData - Booking data
   * @returns {Promise<Object>} Created booking object
   */
  async create(bookingData) {
    try {
      // Generate booking reference if not provided
      if (!bookingData.bookingReference) {
        bookingData.bookingReference = this.generateBookingReference();
      }

      // Generate access token if not provided
      if (!bookingData.accessToken) {
        bookingData.accessToken = this.generateAccessToken();
      }

      // Set token expiration if not provided
      if (!bookingData.tokenExpiresAt) {
        bookingData.tokenExpiresAt = this.getTokenExpiration();
      }

      // Transform camelCase to snake_case for PostgreSQL
      const pgData = {
        booking_reference: bookingData.bookingReference,
        ru_reservation_id: bookingData.ruReservationId,
        user_id: bookingData.userId,
        building_id: bookingData.buildingId,
        unit_id: bookingData.unitId,
        ru_property_id: bookingData.ruPropertyId,
        check_in: bookingData.checkIn,
        check_out: bookingData.checkOut,
        nights: bookingData.nights,
        guest_info: bookingData.guestInfo,
        number_of_guests: bookingData.numberOfGuests,
        number_of_adults: bookingData.numberOfAdults,
        number_of_children: bookingData.numberOfChildren,
        number_of_infants: bookingData.numberOfInfants,
        pricing: bookingData.pricing,
        applied_coupon: bookingData.appliedCoupon,
        coupon_id: bookingData.couponId,
        payment: bookingData.payment,
        status: bookingData.status || 'pending',
        ru_status: bookingData.ruStatus,
        booking_source: bookingData.bookingSource || 'direct',
        cancellation: bookingData.cancellation,
        special_requests: bookingData.specialRequests,
        access_token: bookingData.accessToken,
        token_expires_at: bookingData.tokenExpiresAt
      };

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(pgData)
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to create booking', error);
      }

      return transformBooking(data);
    } catch (error) {
      throw new DatabaseError('Failed to create booking', error);
    }
  }

  /**
   * Update booking by ID
   * @param {string} id - Booking ID
   * @param {Object} updateData - Data to update
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated booking object
   */
  async findByIdAndUpdate(id, updateData, options = {}) {
    try {
      // Transform camelCase to snake_case
      const pgData = {};
      if (updateData.status) pgData.status = updateData.status;
      if (updateData.ruStatus) pgData.ru_status = updateData.ruStatus;
      if (updateData.ruReservationId) pgData.ru_reservation_id = updateData.ruReservationId;
      if (updateData.payment) pgData.payment = updateData.payment;
      if (updateData.cancellation) pgData.cancellation = updateData.cancellation;

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update(pgData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to update booking', error);
      }

      return transformBooking(data);
    } catch (error) {
      throw new DatabaseError('Failed to update booking', error);
    }
  }

  /**
   * Count documents matching query
   * @param {Object} query - Query object
   * @returns {Promise<number>} Count of documents
   */
  async countDocuments(query = {}) {
    try {
      let supabaseQuery = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      // Apply filters
      if (query.status) {
        supabaseQuery = supabaseQuery.eq('status', query.status);
      }

      const { count, error } = await supabaseQuery;

      if (error) {
        throw new DatabaseError('Failed to count bookings', error);
      }

      return count || 0;
    } catch (error) {
      throw new DatabaseError('Failed to count bookings', error);
    }
  }

  /**
   * Populate method (for compatibility)
   * Note: In Supabase, we handle this in the query itself
   */
  populate(field) {
    // This is handled in the query methods above
    return this;
  }

  /**
   * Update one document matching query (for compatibility with Mongoose updateOne)
   * @param {Object} query - Query object
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Update result
   */
  async updateOne(query, updateData) {
    try {
      // Handle nested payment.status updates
      if (updateData['payment.status']) {
        // Need to fetch the booking first, update the payment object, then save
        const booking = await this.findOne(query);
        if (!booking) {
          return { matchedCount: 0, modifiedCount: 0 };
        }
        
        booking.payment.status = updateData['payment.status'];
        if (updateData.status) {
          booking.status = updateData.status;
        }
        
        const pgUpdateData = {
          payment: booking.payment,
          status: booking.status
        };
        
        const { data, error } = await this.supabase
          .from(this.tableName)
          .update(pgUpdateData)
          .eq('id', booking.id || booking._id)
          .select();

        if (error) {
          throw new DatabaseError('Failed to update booking', error);
        }

        return { matchedCount: 1, modifiedCount: data.length };
      }
      
      // Handle regular updates
      const pgData = {};
      if (updateData.status) pgData.status = updateData.status;
      if (updateData.ruStatus) pgData.ru_status = updateData.ruStatus;
      if (updateData.ruReservationId) pgData.ru_reservation_id = updateData.ruReservationId;
      if (updateData.payment) pgData.payment = updateData.payment;
      if (updateData.cancellation) pgData.cancellation = updateData.cancellation;

      // Build query
      let supabaseQuery = this.supabase.from(this.tableName).update(pgData);

      // Apply filters
      if (query.bookingReference) {
        supabaseQuery = supabaseQuery.eq('booking_reference', query.bookingReference);
      }
      if (query['payment.paymentId']) {
        supabaseQuery = supabaseQuery.eq('payment->>paymentId', query['payment.paymentId']);
      }

      const { data, error } = await supabaseQuery.select();

      if (error) {
        throw new DatabaseError('Failed to update booking', error);
      }

      return { matchedCount: data.length, modifiedCount: data.length };
    } catch (error) {
      throw new DatabaseError('Failed to update booking', error);
    }
  }

  /**
   * Save method (for compatibility with Mongoose-style updates)
   * @param {Object} booking - Booking object with id
   * @returns {Promise<Object>} Updated booking
   */
  async save(booking) {
    if (!booking.id && !booking._id) {
      throw new Error('Booking ID is required for save operation');
    }
    
    const bookingId = booking.id || booking._id;
    
    // Transform the entire booking object for update
    const updateData = {
      status: booking.status,
      ru_status: booking.ruStatus,
      ru_reservation_id: booking.ruReservationId,
      payment: booking.payment,
      cancellation: booking.cancellation,
      pricing: booking.pricing,
      guest_info: booking.guestInfo,
      special_requests: booking.specialRequests
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      throw new DatabaseError('Failed to save booking', error);
    }

    return transformBooking(data);
  }
}

module.exports = new BookingRepository();
