# Create PostgreSQL Schema in Supabase

## Steps:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `cvaeknitestkrhodywfm`
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste the entire content of `db/schema.sql` file
6. Click "Run" button

## OR use this command:

If you have `psql` installed, you can run:

```bash
# Get your database connection string from Supabase dashboard
# It looks like: postgresql://postgres:[YOUR-PASSWORD]@db.cvaeknitestkrhodywfm.supabase.co:5432/postgres

psql "YOUR_CONNECTION_STRING" -f db/schema.sql
```

## After creating the schema:

Run the migration again:
```bash
node migration/migrate.js --yes
```

## Note:

The schema creates tables with `ho_` prefix:
- ho_buildings
- ho_units  
- ho_users
- ho_coupons
- ho_bookings
- ho_property_daily_cache

This avoids conflicts with any existing tables in your Supabase database.
