# MongoDB to PostgreSQL/Supabase Migration Guide

## Overview

This guide documents the migration of hodo-stay-backend from MongoDB to PostgreSQL/Supabase while maintaining complete backward compatibility with the hodo-stay frontend.

## Migration Strategy

### Zero-Downtime Approach
- **Database Switching**: Use `DATABASE_TYPE` environment variable to switch between MongoDB and Supabase
- **Dual Support**: All code supports both databases during transition
- **No Frontend Changes**: API responses remain identical via response transformers
- **Gradual Migration**: Test thoroughly in staging before production switch

## Environment Variables

### Required Variables

```bash
# Database Selection
DATABASE_TYPE=supabase  # or 'mongodb' for legacy

# MongoDB (Legacy)
MONGODB_URI=mongodb://...

# Supabase (New)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

## Database Schema

### Table Naming Convention
All PostgreSQL tables use `ho_` prefix:
- `ho_bookings` (was `bookings` collection)
- `ho_units` (was `units` collection)
- `ho_buildings` (was `buildings` collection)
- `ho_users` (was `users` collection)
- `ho_coupons` (was `coupons` collection)
- `ho_property_daily_cache` (was `propertydailycaches` collection)

### Field Naming Convention
- **PostgreSQL**: snake_case (e.g., `booking_reference`, `guest_info`)
- **MongoDB**: camelCase (e.g., `bookingReference`, `guestInfo`)
- **API Responses**: camelCase (maintained for frontend compatibility)

### Data Type Mappings

| MongoDB | PostgreSQL | Notes |
|---------|-----------|-------|
| ObjectId | UUID | Primary keys |
| Embedded Document | JSONB | Nested objects (guestInfo, pricing, etc.) |
| Array | JSONB | Arrays of objects (images, amenities) |
| Array of Strings | TEXT[] | Simple string arrays (cities, specificUsers) |
| Date | TIMESTAMPTZ | Timestamps with timezone |

## Code Architecture

### Repository Pattern

All database operations go through repository classes that provide Mongoose-compatible interfaces:

```javascript
// MongoDB (Legacy)
const Booking = require('../models/Booking');

// Supabase (New)
const bookingRepository = require('../repositories/bookingRepository');

// Adapter Pattern
const USE_SUPABASE = process.env.DATABASE_TYPE === 'supabase';
const Booking = USE_SUPABASE ? bookingRepository : MongooseBooking;
```

### Repository Methods

Repositories implement Mongoose-compatible methods:
- `find(query, options)` - Find multiple documents
- `findOne(query, options)` - Find single document
- `findById(id, options)` - Find by ID
- `create(data)` - Create new document
- `findByIdAndUpdate(id, data, options)` - Update by ID
- `updateOne(query, update)` - Update single document
- `updateMany(filter, update)` - Update multiple documents
- `deleteMany(filter)` - Delete multiple documents
- `countDocuments(query)` - Count documents
- `bulkWrite(operations)` - Bulk operations
- `save(document)` - Save document
- `populate(field)` - Populate references (handled in queries)

### Response Transformers

All Supabase responses are transformed from snake_case to camelCase:

```javascript
const { transformBooking } = require('../utils/responseTransformers');

// Supabase returns snake_case
const pgData = { booking_reference: 'HODO-20260417-1234', guest_info: {...} };

// Transform to camelCase for API
const apiData = transformBooking(pgData);
// { bookingReference: 'HODO-20260417-1234', guestInfo: {...} }
```

### Transaction Handling

**MongoDB** uses sessions for transactions:
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Booking.create(data, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
}
```

**Supabase** doesn't require explicit transactions for single operations:
```javascript
// Supabase handles atomicity automatically
await Booking.create(data);
```

## Migration Checklist

### Pre-Migration

- [ ] Set up new Supabase project
- [ ] Execute schema.sql to create all tables
- [ ] Verify all indexes are created
- [ ] Test Supabase connection from backend
- [ ] Set up environment variables in staging

### Code Migration (Completed)

- [x] Create Supabase client wrapper
- [x] Create response transformers
- [x] Create all repository classes
- [x] Update booking controller
- [x] Update building controller
- [x] Update payment controller
- [x] Update coupon service
- [x] Update webhook controller
- [x] Update property cache sync service
- [x] Update all cron jobs and scripts

### Data Migration

- [ ] Export data from MongoDB
- [ ] Transform data (ObjectId → UUID, camelCase → snake_case)
- [ ] Import data to PostgreSQL
- [ ] Verify data integrity
- [ ] Validate foreign key relationships
- [ ] Compare record counts

### Testing

- [ ] Test all API endpoints in staging
- [ ] Test payment flows (Razorpay)
- [ ] Test RU API synchronization
- [ ] Test webhook handling
- [ ] Test cron jobs
- [ ] Verify frontend compatibility
- [ ] Load test critical endpoints
- [ ] Compare performance with MongoDB

### Deployment

- [ ] Deploy to staging with `DATABASE_TYPE=supabase`
- [ ] Monitor for errors
- [ ] Test all user flows
- [ ] Deploy to production
- [ ] Monitor performance metrics
- [ ] Keep MongoDB as backup for 30 days

## Query Pattern Examples

### Find Operations

```javascript
// MongoDB
const bookings = await Booking.find({ status: 'confirmed' })
  .populate('unitId')
  .sort({ createdAt: -1 })
  .limit(10);

// Supabase (same interface)
const bookings = await Booking.find({ status: 'confirmed' }, {
  populate: ['unitId'],
  sort: { createdAt: -1 },
  limit: 10
});
```

### Create Operations

```javascript
// MongoDB
const booking = new Booking(data);
await booking.save();

// Supabase
const booking = await Booking.create(data);
```

### Update Operations

```javascript
// MongoDB
await Booking.findByIdAndUpdate(id, { status: 'confirmed' });

// Supabase (same interface)
await Booking.findByIdAndUpdate(id, { status: 'confirmed' });
```

### JSONB Queries

```javascript
// Query nested JSONB fields
const bookings = await Booking.find({
  'guestInfo.email': 'user@example.com'
});
```

## Performance Considerations

### Indexes

All critical indexes are defined in schema.sql:
- Primary keys (UUID)
- Foreign keys
- Query optimization indexes
- JSONB GIN indexes for nested queries
- Composite indexes for common queries

### Connection Pooling

Supabase client uses connection pooling automatically:
```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);
```

### Query Optimization

- Use `.select()` to fetch only needed columns
- Use `.single()` for single record queries
- Use `.limit()` for pagination
- Use indexes for WHERE clauses

## Rollback Procedure

If issues occur after migration:

1. **Immediate Rollback**:
   ```bash
   # Set environment variable back to MongoDB
   DATABASE_TYPE=mongodb
   
   # Restart application
   pm2 restart hodo-stay-backend
   ```

2. **Verify Rollback**:
   - Check application logs
   - Test critical endpoints
   - Verify bookings are working

3. **Investigate Issues**:
   - Review error logs
   - Check data integrity
   - Identify root cause

4. **Fix and Retry**:
   - Fix identified issues
   - Test in staging
   - Retry migration

## Monitoring

### Key Metrics to Monitor

- **Response Times**: Should be <200ms for 95th percentile
- **Error Rates**: Should be <0.1%
- **Database Connections**: Monitor connection pool usage
- **Query Performance**: Track slow queries (>100ms)
- **Cache Hit Rate**: Monitor property cache effectiveness

### Logging

All database operations log:
- Query execution time
- Errors with stack traces
- Transaction commits/rollbacks
- Data transformation issues

## Common Issues and Solutions

### Issue: Slow Queries

**Solution**: Check indexes are created:
```sql
SELECT * FROM pg_indexes WHERE tablename = 'ho_bookings';
```

### Issue: JSONB Query Not Working

**Solution**: Use proper JSONB operators:
```javascript
// Correct
.eq('guest_info->>email', 'user@example.com')

// Incorrect
.eq('guest_info.email', 'user@example.com')
```

### Issue: Foreign Key Violation

**Solution**: Ensure referenced records exist before creating:
```javascript
// Verify unit exists
const unit = await Unit.findById(unitId);
if (!unit) throw new Error('Unit not found');

// Then create booking
await Booking.create({ unitId, ... });
```

### Issue: Date Timezone Issues

**Solution**: Always use ISO strings with timezone:
```javascript
const date = new Date().toISOString(); // 2026-04-17T10:30:00.000Z
```

## Support and Troubleshooting

### Enable Debug Logging

```bash
# Enable Supabase debug logs
DEBUG=supabase:* npm start
```

### Check Database Connection

```javascript
const { getSupabaseClient } = require('./db/supabaseClient');
const supabase = getSupabaseClient();

// Test query
const { data, error } = await supabase.from('ho_bookings').select('count');
console.log('Connection test:', error ? 'Failed' : 'Success');
```

### Verify Data Integrity

```sql
-- Check record counts
SELECT 'bookings' as table_name, COUNT(*) FROM ho_bookings
UNION ALL
SELECT 'units', COUNT(*) FROM ho_units
UNION ALL
SELECT 'buildings', COUNT(*) FROM ho_buildings;

-- Check foreign key integrity
SELECT COUNT(*) FROM ho_bookings b
LEFT JOIN ho_units u ON b.unit_id = u.id
WHERE u.id IS NULL;
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [Migration Design Document](./design.md)
- [Database Schema](./db/schema.sql)

## Contact

For migration support, contact the development team.
