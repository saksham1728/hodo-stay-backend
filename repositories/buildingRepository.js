const supabase = require('../db/supabaseClient');
const { transformBuilding } = require('../utils/responseTransformers');

/**
 * Building Repository - Provides Mongoose-compatible interface for Supabase
 * Handles all database operations for buildings table
 */
class BuildingRepository {
  constructor() {
    this.tableName = 'ho_buildings';
  }

  /**
   * Find building by ID
   * @param {string} id - Building ID
   * @param {Object} options - Query options (select)
   * @returns {Promise<Object|null>}
   */
  async findById(id, options = {}) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error finding building by ID: ${error.message}`);
    }

    return data ? transformBuilding(data) : null;
  }

  /**
   * Find one building matching conditions
   * @param {Object} conditions - Query conditions
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>}
   */
  async findOne(conditions, options = {}) {
    let query = supabase
      .from(this.tableName)
      .select('*');

    query = this._applyConditions(query, conditions);
    query = query.limit(1).single();

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Error finding building: ${error.message}`);
    }

    return data ? transformBuilding(data) : null;
  }

  /**
   * Find multiple buildings matching conditions
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
      throw new Error(`Error finding buildings: ${error.message}`);
    }

    return data ? data.map(transformBuilding) : [];
  }

  /**
   * Create new building
   * @param {Object} buildingData - Building data
   * @returns {Promise<Object>}
   */
  async create(buildingData) {
    const snakeCaseData = this._toSnakeCaseObject(buildingData);

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(snakeCaseData)
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating building: ${error.message}`);
    }

    return transformBuilding(data);
  }

  /**
   * Update building by ID
   * @param {string} id - Building ID
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
      throw new Error(`Error updating building: ${error.message}`);
    }

    return data ? transformBuilding(data) : null;
  }

  /**
   * Update one building matching conditions
   * @param {Object} conditions - Query conditions
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>}
   */
  async findOneAndUpdate(conditions, updateData, options = {}) {
    // First find the building
    const building = await this.findOne(conditions);
    if (!building) return null;

    // Then update it
    return this.findByIdAndUpdate(building.id, updateData, options);
  }

  /**
   * Delete building by ID
   * @param {string} id - Building ID
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
      throw new Error(`Error deleting building: ${error.message}`);
    }

    return data ? transformBuilding(data) : null;
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
      throw new Error(`Error counting buildings: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Save building (update if exists, create if new)
   * @param {Object} building - Building object
   * @returns {Promise<Object>}
   */
  async save(building) {
    if (building.id) {
      return this.findByIdAndUpdate(building.id, building);
    } else {
      return this.create(building);
    }
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

module.exports = new BuildingRepository();
