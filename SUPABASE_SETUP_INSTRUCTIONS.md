# Supabase Setup Instructions

## ⚠️ IMPORTANT: Get Your Service Role Key

Before running the migration, you need to get the **Service Role Key** from your Supabase project.

### Steps to Get Service Role Key:

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/jtdwarqrmaqtnqztmkyz

2. **Navigate to API Settings**
   - Click on **Settings** (gear icon) in the left sidebar
   - Select **API** from the settings menu

3. **Copy the Service Role Key**
   - Scroll down to "Project API keys" section
   - Find the **`service_role`** key (NOT the `anon` key)
   - Click the eye icon to reveal the key
   - Copy the entire key

4. **Update .env File**
   - Open `hodo-stay-backend/.env`
   - Replace the placeholder in `SUPABASE_SERVICE_KEY` with your actual key:
   ```
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ACTUAL_SERVICE_KEY_HERE
   ```

### Why Service Role Key?

- The **service role key** bypasses Row Level Security (RLS) policies
- It's required for backend operations that need full database access
- **Never expose this key to the frontend or commit it to version control!**

## Running the Database Setup

Once you have the service role key configured:

```bash
# Install dependencies (if not already done)
npm install

# Run the database setup script
node db/setup-database.js
```

This will create all tables with the `ho_` prefix:
- `ho_buildings`
- `ho_units`
- `ho_users`
- `ho_coupons`
- `ho_bookings`
- `ho_property_daily_cache`

## Alternative: Manual Setup via Supabase Dashboard

If the automated script doesn't work:

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `hodo-stay-backend/db/schema.sql`
5. Copy the entire file contents
6. Paste into the SQL Editor
7. Click **Run** to execute

## Verification

After setup, verify the connection:

```bash
node -e "require('./db/supabaseClient').testConnection()"
```

You should see:
```
✅ Supabase client initialized successfully
✅ Database connection test successful
```

## Next Steps

After database setup is complete:

1. ✅ Tables created in Supabase
2. 🔄 Implement response transformers (Task 3)
3. 🔄 Migrate booking controller (Task 4)
4. 🔄 Continue with remaining migration tasks

## Troubleshooting

### "SUPABASE_SERVICE_KEY environment variable is not set"
- Make sure you've added the service role key to `.env`
- Restart your terminal/IDE after updating `.env`

### "Failed to connect to Supabase"
- Verify the `SUPABASE_URL` is correct
- Check that your service role key is valid
- Ensure your IP is allowed in Supabase project settings

### "Table already exists"
- This is normal if you've run setup before
- The script handles this gracefully with `IF NOT EXISTS`
- You can safely re-run the setup

## Security Notes

🔒 **Keep your service role key secure:**
- Never commit it to Git
- Don't expose it in frontend code
- Don't share it publicly
- Rotate it if compromised

The `.env` file is already in `.gitignore` to prevent accidental commits.
