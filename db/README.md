# Database Setup Guide

This directory contains the PostgreSQL/Supabase database schema and setup scripts for the Hodo Stay backend migration.

## Files

- `schema.sql` - Complete PostgreSQL schema with all tables, indexes, and triggers
- `supabaseClient.js` - Supabase client wrapper with connection pooling and error handling
- `setup-database.js` - Automated script to create all tables in Supabase

## Table Structure

All tables use the `ho_` prefix to avoid conflicts with existing schemas:

- `ho_buildings` - Property building information
- `ho_units` - Individual rental units
- `ho_users` - User accounts
- `ho_coupons` - Discount coupons
- `ho_bookings` - Booking records
- `ho_property_daily_cache` - Daily pricing and availability cache

## Setup Instructions

### Option 1: Automated Setup (Recommended)

1. Ensure environment variables are set in `.env`:
   ```
   SUPABASE_URL=https://jtdwarqrmaqtnqztmkyz.supabase.co
   SUPABASE_SERVICE_KEY=your_service_role_key_here
   ```

2. Run the setup script:
   ```bash
   node db/setup-database.js
   ```

### Option 2: Manual Setup

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/jtdwarqrmaqtnqztmkyz

2. Navigate to **SQL Editor** in the left sidebar

3. Click **New Query**

4. Copy the entire contents of `schema.sql`

5. Paste into the SQL Editor

6. Click **Run** to execute the schema

7. Verify all tables were created in the **Table Editor**

## Getting the Service Role Key

The `SUPABASE_SERVICE_KEY` is required for backend operations:

1. Go to your Supabase project dashboard
2. Click on **Settings** (gear icon) in the left sidebar
3. Navigate to **API** section
4. Find the **service_role** key under "Project API keys"
5. Copy this key and add it to your `.env` file

⚠️ **Important**: Never expose the service role key to the frontend or commit it to version control!

## Verification

After setup, verify the tables exist:

```bash
node -e "require('./db/supabaseClient').testConnection()"
```

You should see:
```
✅ Supabase client initialized successfully
✅ Database connection test successful
```

## Schema Features

### Automatic Timestamps
All tables have `created_at` and `updated_at` columns that are automatically managed by triggers.

### JSONB Columns
Complex nested data is stored in JSONB columns for flexibility:
- `guest_info` - Guest contact information
- `pricing` - Detailed pricing breakdown
- `payment` - Payment transaction details
- `location` - Property location data
- `amenities` - Property amenities
- And more...

### Indexes
Optimized indexes are created for:
- Foreign key relationships
- Frequently queried columns (status, dates, email)
- JSONB field queries
- Full-text search capabilities

### Data Cleanup
The `ho_property_daily_cache` table includes automatic cleanup of records older than 180 days via the `cleanup_old_cache_records()` function.

To schedule automatic cleanup, you can:
1. Use pg_cron extension (if available)
2. Set up a cron job to call the function
3. Run it manually periodically

## Troubleshooting

### Connection Errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- Check that your IP is allowed in Supabase project settings
- Ensure you're using the service role key, not the anon key

### Table Already Exists
- This is normal if you've run the setup before
- The script uses `CREATE TABLE IF NOT EXISTS` to handle this gracefully
- You can safely re-run the setup script

### Permission Errors
- Ensure you're using the `service_role` key, not the `anon` key
- The service role key bypasses Row Level Security (RLS) policies

## Next Steps

After database setup:

1. ✅ Install dependencies: `npm install`
2. ✅ Verify connection: `node db/setup-database.js`
3. 🔄 Migrate data from MongoDB (see migration scripts)
4. 🔄 Update application code to use Supabase
5. 🧪 Test all endpoints
6. 🚀 Deploy to production

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs
- Review the migration spec: `.kiro/specs/mongodb-to-postgresql-migration/`
- Contact the development team
