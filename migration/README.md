# Data Migration Scripts

## Quick Start

```bash
# Run complete migration (all 3 steps)
node migration/migrate.js
```

## Manual Steps

If you want to run steps individually:

```bash
# Step 1: Export from MongoDB
node migration/exportData.js

# Step 2: Transform data
node migration/transformData.js

# Step 3: Import to PostgreSQL
node migration/importData.js
```

## Prerequisites

1. **MongoDB** must be running and accessible
2. **Supabase** credentials in `.env`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-key
   ```
3. **Schema** must be created in Supabase:
   ```bash
   # Execute db/schema.sql in Supabase SQL Editor
   ```

## What It Does

1. **Export**: Reads all data from MongoDB collections
2. **Transform**: 
   - Converts MongoDB ObjectId → PostgreSQL UUID
   - Converts camelCase → snake_case
   - Preserves relationships via ID mappings
3. **Import**: Inserts data into PostgreSQL in correct order (respecting foreign keys)

## After Migration

1. Verify data in Supabase dashboard
2. Update `.env`: `DATABASE_TYPE=supabase`
3. Restart application
4. Test all functionality
5. Keep MongoDB as backup for 30 days

## Rollback

If issues occur:
```bash
# In .env
DATABASE_TYPE=mongodb

# Restart application
pm2 restart hodo-stay-backend
```

## Data Directories

- `exported-data/` - Raw MongoDB exports (JSON)
- `transformed-data/` - Transformed PostgreSQL-ready data (JSON)
