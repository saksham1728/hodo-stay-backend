/**
 * PropertyDailyCache Repository
 * 
 * Data access layer for property daily cache using Supabase
 * Provides Mongoose-like interface for backward compatibility
 */

const { getSupabaseClient, DatabaseError, NotFoundError } = require('../db/supabaseClient');

class PropertyDailyCacheRepository {
  constructor() {
    this.tableName = 'ho_property_daily_cache';
    this.supabase = getSupabaseClient();
  }

  /**
   * Find cache records by query
   * @param {Object} query - Query object
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of cache records
   */
  async find(query = {}, options = {}) {
    try {
      let supabaseQuery = this.supabase.from(this.tableName).select('*');

      // Apply filters
      if (query.unitId) {
        supabaseQuery = supabaseQuery.eq('unit_id', query.unitId);
      }
      if (query.ruPropertyId) {
        supabaseQuery = supabaseQuery.eq('ru_property_id', query.ruPropertyId);
      }
      if (query.date) {
        if (query.date.$gte) {
          supabaseQuery = supabaseQuery.gte('date', query.date.$gte.toISOString());
        }
        if (query.date.$lt) {
          supabaseQuery = supabaseQuery.lt('date', query.date.$lt.toISOString());
        }
        if (query.date.$lte) {
          supabaseQuery = supabaseQuery.lte('date', query.date.$lte.toISOString());
        }
      }
      if (query.isAvailable !== undefined) {
        supabaseQuery = supabaseQuery.eq('is_available', query.isAvailable);
      }

      // Apply sorting
      if (options.sort) {
        const sortField = Object.keys(options.sort)[0];
        const sortOrder = options.sort[sortField] === -1 ? 'desc' : 'asc';
        const pgField = sortField === 'date' ? 'date' : sortField;
        supabaseQuery = supabaseQuery.order(pgField, { ascending: sortOrder === 'asc' });
      }

      const { data, error } = await supabaseQuery;

      if (error) {
        throw new DatabaseError('Failed to fetch property daily cache', error);
      }

      // Transform snake_case to camelCase
      return (data || []).map(record => ({
        id: record.id,
        _id: record.id, // For compatibility
        unitId: record.unit_id,
        ruPropertyId: record.ru_property_id,
        date: new Date(record.date),
        isAvailable: record.is_available,
        pricePerNight: record.price_per_night,
        currency: record.currency,
        lastSynced: new Date(record.last_synced),
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at)
      }));
    } catch (error) {
      throw new DatabaseError('Failed to find property daily cache', error);
    }
  }

  /**
   * Bulk write operations (upsert)
   * @param {Array} operations - Array of bulk operations
   * @returns {Promise<Object>} Result object
   */
  async bulkWrite(operations) {
    try {
      let upsertedCount = 0;
      let modifiedCount = 0;

      // Process each operation
      for (const op of operations) {
        if (op.updateOne) {
          const { filter, update, upsert } = op.updateOne;
          
          // Transform filter
          const unitId = filter.unitId;
          const date = filter.date.toISOString().split('T')[0]; // YYYY-MM-DD format
          
          // Transform update data
          const updateData = {
            unit_id: unitId,
            date: date,
            ru_property_id: update.$set.ruPropertyId,
            is_available: update.$set.isAvailable,
            price_per_night: update.$set.pricePerNight,
            last_synced: update.$set.lastSynced.toISOString()
          };

          if (upsert) {
            // Use Supabase upsert
            const { data, error } = await this.supabase
              .from(this.tableName)
              .upsert(updateData, {
                onConflict: 'unit_id,date',
                ignoreDuplicates: false
              })
              .select();

            if (error) {
              console.error('Upsert error:', error);
              throw new DatabaseError('Failed to upsert property daily cache', error);
            }

            if (data && data.length > 0) {
              // Check if it was an insert or update by checking if created_at === updated_at
              const record = data[0];
              if (record.created_at === record.updated_at) {
                upsertedCount++;
              } else {
                modifiedCount++;
              }
            }
          }
        }
      }

      return {
        upsertedCount,
        modifiedCount,
        ok: 1
      };
    } catch (error) {
      throw new DatabaseError('Failed to bulk write property daily cache', error);
    }
  }

  /**
   * Update many records
   * @param {Object} filter - Filter object
   * @param {Object} update - Update object
   * @returns {Promise<Object>} Update result
   */
  async updateMany(filter, update) {
    try {
      let supabaseQuery = this.supabase.from(this.tableName).update({});

      // Transform update data
      const updateData = {};
      if (update.$set) {
        if (update.$set.isAvailable !== undefined) {
          updateData.is_available = update.$set.isAvailable;
        }
        if (update.$set.lastSynced) {
          updateData.last_synced = update.$set.lastSynced.toISOString();
        }
      }

      supabaseQuery = this.supabase.from(this.tableName).update(updateData);

      // Apply filters
      if (filter.unitId) {
        supabaseQuery = supabaseQuery.eq('unit_id', filter.unitId);
      }
      if (filter.date) {
        if (filter.date.$gte) {
          supabaseQuery = supabaseQuery.gte('date', filter.date.$gte.toISOString());
        }
        if (filter.date.$lt) {
          supabaseQuery = supabaseQuery.lt('date', filter.date.$lt.toISOString());
        }
      }

      const { data, error } = await supabaseQuery.select();

      if (error) {
        throw new DatabaseError('Failed to update property daily cache', error);
      }

      return {
        matchedCount: data.length,
        modifiedCount: data.length,
        ok: 1
      };
    } catch (error) {
      throw new DatabaseError('Failed to update many property daily cache', error);
    }
  }

  /**
   * Delete many records
   * @param {Object} filter - Filter object
   * @returns {Promise<Object>} Delete result
   */
  async deleteMany(filter) {
    try {
      let supabaseQuery = this.supabase.from(this.tableName).delete();

      // Apply filters
      if (filter.date) {
        if (filter.date.$lt) {
          supabaseQuery = supabaseQuery.lt('date', filter.date.$lt.toISOString());
        }
      }

      const { data, error } = await supabaseQuery.select();

      if (error) {
        throw new DatabaseError('Failed to delete property daily cache', error);
      }

      return {
        deletedCount: data.length,
        ok: 1
      };
    } catch (error) {
      throw new DatabaseError('Failed to delete many property daily cache', error);
    }
  }
}

module.exports = new PropertyDailyCacheRepository();
