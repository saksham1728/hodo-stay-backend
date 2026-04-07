const { createClient } = require('@supabase/supabase-js');

let supabase = null;
let connectionAttempts = 0;
const MAX_RETRIES = 3;

/**
 * Initialize Supabase client with retry logic and circuit breaker pattern
 */
function initializeSupabase() {
  try {
    // Validate environment variables
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_SERVICE_KEY environment variable is not set');
    }

    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-application-name': 'hodo-stay-backend'
          }
        }
      }
    );

    connectionAttempts = 0;
    console.log('✅ Supabase client initialized successfully');
    return supabase;
  } catch (error) {
    connectionAttempts++;
    console.error(`❌ Failed to initialize Supabase client (attempt ${connectionAttempts}/${MAX_RETRIES}):`, error.message);
    
    if (connectionAttempts >= MAX_RETRIES) {
      throw new Error(`Failed to connect to Supabase after ${MAX_RETRIES} attempts: ${error.message}`);
    }
    
    // Retry with exponential backoff
    const retryDelay = 1000 * connectionAttempts;
    console.log(`⏳ Retrying in ${retryDelay}ms...`);
    setTimeout(() => initializeSupabase(), retryDelay);
  }
}

/**
 * Get Supabase client instance
 * @returns {Object} Supabase client
 */
function getSupabaseClient() {
  if (!supabase) {
    return initializeSupabase();
  }
  return supabase;
}

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('ho_buildings')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Database connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test error:', error.message);
    return false;
  }
}

/**
 * Custom error classes for better error handling
 */
class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

module.exports = {
  getSupabaseClient,
  initializeSupabase,
  testConnection,
  DatabaseError,
  NotFoundError,
  ValidationError
};
