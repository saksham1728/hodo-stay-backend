const { getSupabaseClient } = require('../db/supabaseClient');
const { transformUnit } = require('../utils/responseTransformers');

/**
 * Unit Repository - Provides Mongoose-compatible interface for Supabase
 * Handles all database operations for units table
 */
class UnitRepository {
  constructor() {
    this.tableName = 'ho_units';
  }

  /**
   * Get Supabase client instance
   */
  _getClient() {
    return getSupabaseClient();
  }

  /**
   * Find unit by ID
   * @param {string} id - Unit ID
   * @param {Object} options - Query options (populate, select)
   * @returns {Promise<Object|null>}
   */
  async findById(id, options = {}) {
    let query = this._getClient()
      .from(this.tableName)
      .select(this._buildSelectString(options))
      .eq('id', id)
      .single();

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error finding unit by ID: ${error.message}`);
    }

    return data ? transformUnit(data) : null;
  }

  /**
   * Find one unit matching conditions
   * @param {Object} conditions - Query conditions
   * @param {Object} options - Query options (populate, select)
   * @returns {Promise<Object|null>}
   */
  async findOne(conditions, options = {}) {
    let query = this._getClient()
      .from(this.tableName)
      .select(this._buildSelectString(options));

    query = this._applyConditions(query, conditions);
    query = query.limit(1).single();

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error finding unit: ${error.message}`);
    }

    return data ? transformUnit(data) : null;
  }

  /**
   * Find multiple units matching conditions
   * @param {Object} conditions - Query conditions
   * @param {Object} options - Query options (populate, select, sort, skip, limit)
   * @returns {Promise<Array>}
   */
  async find(conditions = {}, options = {}) {
    let query = this._getClient()
      .from(this.tableName)
      .select(this._buildSelectString(options));

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
      throw new Error(`Error finding units: ${error.message}`);
    }

    return data ? data.map(transformUnit) : [];
  }

  /**
   * Create new unit
   * @param {Object} unitData - Unit data
   * @returns {Promise<Object>}
   */
  async create(unitData) {
    const snakeCaseData = this._toSnakeCaseObject(unitData);

    const { data, error } = await this._getClient()
      .from(this.tableName)
      .insert(snakeCaseData)
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating unit: ${error.message}`);
    }

    return transformUnit(data);
  }

  /**
   * Update unit by ID
   * @param {string} id - Unit ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>}
   */
  async findByIdAndUpdate(id, updateData, options = {}) {
    const snakeCaseData = this._toSnakeCaseObject(updateData);

    const { data, error } = await this._getClient()
      .from(this.tableName)
      .update(snakeCaseData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error updating unit: ${error.message}`);
    }

    return data ? transformUnit(data) : null;
  }

  /**
   * Update one unit matching conditions
   * @param {Object} conditions - Query conditions
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>}
   */
  async findOneAndUpdate(conditions, updateData, options = {}) {
    // First find the unit
    const unit = await this.findOne(conditions);
    if (!unit) return null;

    // Then update it
    return this.findByIdAndUpdate(unit.id, updateData, options);
  }

  /**
   * Delete unit by ID
   * @param {string} id - Unit ID
   * @returns {Promise<Object|null>}
   */
  async findByIdAndDelete(id) {
    const { data, error } = await this._getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error deleting unit: ${error.message}`);
    }

    return data ? transformUnit(data) : null;
  }

  /**
   * Count documents matching conditions
   * @param {Object} conditions - Query conditions
   * @returns {Promise<number>}
   */
  async countDocuments(conditions = {}) {
    let query = this._getClient()
      .from(this.tableName)
      .select('id', { count: 'exact', head: true });

    query = this._applyConditions(query, conditions);

    const { count, error } = await query;

    if (error) {
      throw new Error(`Error counting units: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Save unit (update if exists, create if new)
   * @param {Object} unit - Unit object
   * @returns {Promise<Object>}
   */
  async save(unit) {
    if (unit.id) {
      return this.findByIdAndUpdate(unit.id, unit);
    } else {
      return this.create(unit);
    }
  }

  // Helper methods

  /**
   * Build select string with joins for populate
   */
  _buildSelectString(options) {
    let selectStr = '*';

    if (options.populate) {
      const populates = Array.isArray(options.populate) ? options.populate : [options.populate];
      
      if (populates.includes('buildingId')) {
        selectStr += ', ho_buildings!building_id(*)';
      }
    }

    return selectStr;
  }

  /**
   * Apply query conditions to Supabase query
   */
  _applyConditions(query, conditions) {
    for (const [key, value] of Object.entries(conditions)) {
      const snakeKey = this._toSnakeCase(key);

      if (value === null || value === 'null') {
        // Handle null values (both actual null and string "null")
        query = query.is(snakeKey, null);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle operators like $gte, $lte, $in, $ne, etc.
        for (const [op, opValue] of Object.entries(value)) {
          // Normalize null values
          const normalizedValue = (opValue === 'null' || opValue === null) ? null : opValue;
          
          switch (op) {
            case '$gte':
              query = query.gte(snakeKey, normalizedValue);
              break;
            case '$gt':
              query = query.gt(snakeKey, normalizedValue);
              break;
            case '$lte':
              query = query.lte(snakeKey, normalizedValue);
              break;
            case '$lt':
              query = query.lt(snakeKey, normalizedValue);
              break;
            case '$ne':
              // For $ne with null, check if field is not null
              if (normalizedValue === null) {
                query = query.not(snakeKey, 'is', null);
              } else {
                query = query.neq(snakeKey, normalizedValue);
              }
              break;
            case '$in':
              query = query.in(snakeKey, normalizedValue);
              break;
            case '$exists':
              // MongoDB $exists operator - check if field is not null
              if (opValue) {
                query = query.not(snakeKey, 'is', null);
              } else {
                query = query.is(snakeKey, null);
              }
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

module.exports = new UnitRepository();
