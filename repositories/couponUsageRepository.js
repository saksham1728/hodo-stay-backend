/**
 * CouponUsage Repository
 * 
 * Data access layer for coupon usage tracking using Supabase
 * Provides Mongoose-like interface for backward compatibility
 */

const { getSupabaseClient, DatabaseError } = require('../db/supabaseClient');

class CouponUsageRepository {
  constructor() {
    this.tableName = 'ho_coupon_usage';
  }

  /**
   * Get Supabase client instance
   */
  _getClient() {
    return getSupabaseClient();
  }

  /**
   * Create coupon usage record
   * @param {Object} usageData - Coupon usage data
   * @returns {Promise<Object>}
   */
  async create(usageData) {
    try {
      const pgData = {
        coupon_id: usageData.couponId,
        coupon_code: usageData.couponCode,
        booking_id: usageData.bookingId,
        user_email: usageData.userEmail?.toLowerCase(),
        user_phone: usageData.userPhone,
        original_price: usageData.originalPrice,
        discount_amount: usageData.discountAmount,
        final_price: usageData.finalPrice,
        unit_id: usageData.propertyId, // This is actually unit_id now
        property_name: usageData.propertyName,
        city: usageData.city,
        check_in: usageData.checkIn,
        check_out: usageData.checkOut,
        nights: usageData.nights,
        applied_at: usageData.appliedAt || new Date().toISOString(),
        ip_address: usageData.ipAddress,
        user_agent: usageData.userAgent
      };

      const { data, error } = await this._getClient()
        .from(this.tableName)
        .insert(pgData)
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to create coupon usage', error);
      }

      return this._transformToModel(data);
    } catch (error) {
      throw new DatabaseError('Failed to create coupon usage', error);
    }
  }

  /**
   * Find coupon usage records
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async find(query = {}, options = {}) {
    try {
      let supabaseQuery = this._getClient().from(this.tableName).select('*');

      // Apply filters
      if (query.couponId) {
        supabaseQuery = supabaseQuery.eq('coupon_id', query.couponId);
      }
      if (query.bookingId) {
        supabaseQuery = supabaseQuery.eq('booking_id', query.bookingId);
      }
      if (query.userEmail) {
        supabaseQuery = supabaseQuery.eq('user_email', query.userEmail.toLowerCase());
      }
      if (query.userPhone) {
        supabaseQuery = supabaseQuery.eq('user_phone', query.userPhone);
      }
      if (query.propertyId) {
        supabaseQuery = supabaseQuery.eq('property_id', query.propertyId);
      }
      if (query.couponCode) {
        supabaseQuery = supabaseQuery.eq('coupon_code', query.couponCode.toUpperCase());
      }

      // Date range filters
      if (query.appliedAt) {
        if (query.appliedAt.$gte) {
          supabaseQuery = supabaseQuery.gte('applied_at', query.appliedAt.$gte.toISOString());
        }
        if (query.appliedAt.$lte) {
          supabaseQuery = supabaseQuery.lte('applied_at', query.appliedAt.$lte.toISOString());
        }
      }

      // Apply sorting
      if (options.sort) {
        const sortField = Object.keys(options.sort)[0];
        const sortOrder = options.sort[sortField] === -1 ? 'desc' : 'asc';
        const pgField = this._toSnakeCase(sortField);
        supabaseQuery = supabaseQuery.order(pgField, { ascending: sortOrder === 'asc' });
      } else {
        // Default sort by applied_at descending
        supabaseQuery = supabaseQuery.order('applied_at', { ascending: false });
      }

      // Apply pagination
      if (options.skip !== undefined) {
        supabaseQuery = supabaseQuery.range(options.skip, options.skip + (options.limit || 10) - 1);
      } else if (options.limit) {
        supabaseQuery = supabaseQuery.limit(options.limit);
      }

      const { data, error } = await supabaseQuery;

      if (error) {
        throw new DatabaseError('Failed to fetch coupon usage', error);
      }

      return (data || []).map(record => this._transformToModel(record));
    } catch (error) {
      throw new DatabaseError('Failed to find coupon usage', error);
    }
  }

  /**
   * Find one coupon usage record
   * @param {Object} query - Query conditions
   * @returns {Promise<Object|null>}
   */
  async findOne(query) {
    try {
      let supabaseQuery = this._getClient().from(this.tableName).select('*');

      if (query.bookingId) {
        supabaseQuery = supabaseQuery.eq('booking_id', query.bookingId);
      }
      if (query.couponId) {
        supabaseQuery = supabaseQuery.eq('coupon_id', query.couponId);
      }
      if (query.userEmail) {
        supabaseQuery = supabaseQuery.eq('user_email', query.userEmail.toLowerCase());
      }

      const { data, error } = await supabaseQuery.limit(1).single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new DatabaseError('Failed to fetch coupon usage', error);
      }

      return this._transformToModel(data);
    } catch (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError('Failed to find coupon usage', error);
    }
  }

  /**
   * Count coupon usage records
   * @param {Object} query - Query conditions
   * @returns {Promise<number>}
   */
  async countDocuments(query = {}) {
    try {
      let supabaseQuery = this._getClient()
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (query.couponId) {
        supabaseQuery = supabaseQuery.eq('coupon_id', query.couponId);
      }
      if (query.userEmail) {
        supabaseQuery = supabaseQuery.eq('user_email', query.userEmail.toLowerCase());
      }
      if (query.userPhone) {
        supabaseQuery = supabaseQuery.eq('user_phone', query.userPhone);
      }

      const { count, error } = await supabaseQuery;

      if (error) {
        throw new DatabaseError('Failed to count coupon usage', error);
      }

      return count || 0;
    } catch (error) {
      throw new DatabaseError('Failed to count coupon usage', error);
    }
  }

  /**
   * Get usage statistics for a coupon
   * @param {string} couponId - Coupon ID
   * @returns {Promise<Object>}
   */
  async getCouponStats(couponId) {
    try {
      const usages = await this.find({ couponId });
      
      const totalUsage = usages.length;
      const totalDiscount = usages.reduce((sum, u) => sum + parseFloat(u.discountAmount), 0);
      const uniqueUsers = new Set(usages.map(u => u.userEmail)).size;
      
      return {
        totalUsage,
        totalDiscount,
        uniqueUsers,
        averageDiscount: totalUsage > 0 ? totalDiscount / totalUsage : 0
      };
    } catch (error) {
      throw new DatabaseError('Failed to get coupon stats', error);
    }
  }

  /**
   * Check if user has used a coupon
   * @param {string} couponId - Coupon ID
   * @param {string} userEmail - User email
   * @returns {Promise<boolean>}
   */
  async hasUserUsedCoupon(couponId, userEmail) {
    try {
      const count = await this.countDocuments({ 
        couponId, 
        userEmail: userEmail.toLowerCase() 
      });
      return count > 0;
    } catch (error) {
      throw new DatabaseError('Failed to check coupon usage', error);
    }
  }

  /**
   * Transform database record to model format
   */
  _transformToModel(record) {
    if (!record) return null;

    return {
      id: record.id,
      _id: record.id, // For compatibility
      couponId: record.coupon_id,
      couponCode: record.coupon_code,
      bookingId: record.booking_id,
      userEmail: record.user_email,
      userPhone: record.user_phone,
      originalPrice: parseFloat(record.original_price),
      discountAmount: parseFloat(record.discount_amount),
      finalPrice: parseFloat(record.final_price),
      propertyId: record.property_id,
      propertyName: record.property_name,
      city: record.city,
      checkIn: record.check_in ? new Date(record.check_in) : null,
      checkOut: record.check_out ? new Date(record.check_out) : null,
      nights: record.nights,
      appliedAt: new Date(record.applied_at),
      ipAddress: record.ip_address,
      userAgent: record.user_agent,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at)
    };
  }

  /**
   * Convert camelCase to snake_case
   */
  _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

module.exports = new CouponUsageRepository();
