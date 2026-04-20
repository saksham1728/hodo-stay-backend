const supabase = require('../db/supabaseClient');
const { transformCoupon } = require('../utils/responseTransformers');

/**
 * Coupon Repository - Provides Mongoose-compatible interface for Supabase
 * Handles all database operations for coupons table
 */
class CouponRepository {
  constructor() {
    this.tableName = 'ho_coupons';
  }

  /**
   * Find coupon by ID
   * @param {string} id - Coupon ID
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error finding coupon by ID: ${error.message}`);
    }

    return data ? transformCoupon(data) : null;
  }

  /**
   * Find one coupon matching conditions
   * @param {Object} conditions - Query conditions
   * @returns {Promise<Object|null>}
   */
  async findOne(conditions) {
    let query = supabase
      .from(this.tableName)
      .select('*');

    query = this._applyConditions(query, conditions);
    query = query.limit(1).single();

    const { data, error} = await query;

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error finding coupon: ${error.message}`);
    }

    return data ? transformCoupon(data) : null;
  }

  /**
   * Find multiple coupons matching conditions
   * @param {Object} conditions - Query conditions
   * @param {Object} options - Query options (sort, skip, limit)
   * @returns {Promise<Array>}
   */
  async find(conditions = {}, options = {}) {
    let query = supabase
      .from(this.tableName)
      .select('*');

    query = this._applyConditions(query, conditions);

    // Apply sorting
    if (options.sort) {
      const sortEntries = Object.entries(options.sort);
      for (const [field, direction] of sortEntries) {
        const ascending = direction === 1 || direction === 'asc';
        query = query.order(this._toSnakeCase(field), { ascending });
      }
    }

    // Apply pagination
    if (options.skip) {
      query = query.range(options.skip, options.skip + (options.limit || 10) - 1);
    } else if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error finding coupons: ${error.message}`);
    }

    return data ? data.map(transformCoupon) : [];
  }

  /**
   * Create new coupon
   * @param {Object} couponData - Coupon data
   * @returns {Promise<Object>}
   */
  async create(couponData) {
    const snakeCaseData = this._toSnakeCaseObject(couponData);

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(snakeCaseData)
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating coupon: ${error.message}`);
    }

    return transformCoupon(data);
  }

  /**
   * Update coupon by ID
   * @param {string} id - Coupon ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>}
   */
  async findByIdAndUpdate(id, updateData, options = {}) {
    const snakeCaseData = this._toSnakeCaseObject(updateData);

    const { data, error } = await supabase
      .from(this.tableName)
      .update(snakeCaseData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error updating coupon: ${error.message}`);
    }

    return data ? transformCoupon(data) : null;
  }

  /**
   * Update one coupon matching conditions
   * @param {Object} conditions - Query conditions
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>}
   */
  async findOneAndUpdate(conditions, updateData, options = {}) {
    // First find the coupon
    const coupon = await this.findOne(conditions);
    if (!coupon) return null;

    // Then update it
    return this.findByIdAndUpdate(coupon.id, updateData, options);
  }

  /**
   * Delete coupon by ID
   * @param {string} id - Coupon ID
   * @returns {Promise<Object|null>}
   */
  async findByIdAndDelete(id) {
    const { data, error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error deleting coupon: ${error.message}`);
    }

    return data ? transformCoupon(data) : null;
  }

  /**
   * Count documents matching conditions
   * @param {Object} conditions - Query conditions
   * @returns {Promise<number>}
   */
  async countDocuments(conditions = {}) {
    let query = supabase
      .from(this.tableName)
      .select('id', { count: 'exact', head: true });

    query = this._applyConditions(query, conditions);

    const { count, error } = await query;

    if (error) {
      throw new Error(`Error counting coupons: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Save coupon (update if exists, create if new)
   * @param {Object} coupon - Coupon object
   * @returns {Promise<Object>}
   */
  async save(coupon) {
    if (coupon.id) {
      return this.findByIdAndUpdate(coupon.id, coupon);
    } else {
      return this.create(coupon);
    }
  }

  /**
   * Find valid coupon by code (static method equivalent)
   * @param {string} code - Coupon code
   * @returns {Promise<Object|null>}
   */
  async findValidCoupon(code) {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .lte('valid_from', now)
      .gte('valid_until', now)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error finding valid coupon: ${error.message}`);
    }

    return data ? transformCoupon(data) : null;
  }

  // Helper methods

  /**
   * Apply query conditions to Supabase query
   */
  _applyConditions(query, conditions) {
    for (const [key, value] of Object.entries(conditions)) {
      const snakeKey = this._toSnakeCase(key);

      if (value === null) {
        query = query.is(snakeKey, null);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle operators like $gte, $lte, $in, etc.
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case '$gte':
              query = query.gte(snakeKey, opValue);
              break;
            case '$gt':
              query = query.gt(snakeKey, opValue);
              break;
            case '$lte':
              query = query.lte(snakeKey, opValue);
              break;
            case '$lt':
              query = query.lt(snakeKey, opValue);
              break;
            case '$ne':
              query = query.neq(snakeKey, opValue);
              break;
            case '$in':
              query = query.in(snakeKey, opValue);
              break;
            default:
              query = query.eq(snakeKey, value);
          }
        }
      } else {
        query = query.eq(snakeKey, value);
      }
    }

    return query;
  }

  /**
   * Convert camelCase to snake_case
   */
  _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert object keys from camelCase to snake_case
   */
  _toSnakeCaseObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this._toSnakeCaseObject(item));

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = this._toSnakeCase(key);
      result[snakeKey] = typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value // Keep JSONB objects as-is
        : value;
    }
    return result;
  }
}

module.exports = new CouponRepository();
