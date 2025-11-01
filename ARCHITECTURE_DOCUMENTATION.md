# Hodo Stay - Architecture Documentation

## Overview

Hodo Stay is a property booking platform that integrates with Rentals United API. The system uses a building-centric architecture where:
- **Buildings** are manually created and managed in MongoDB
- **Units** (properties) are automatically synced from Rentals United API
- **Pricing & Availability** are fetched in real-time from Rentals United

**Tech Stack**: Node.js, Express.js, MongoDB, React.js, Rentals United API

---

## System Architecture

```
User → Properties Page (Buildings) → Property Detail (Units) → Booking (Real-time Pricing)
         ↓                              ↓                          ↓
    MongoDB Buildings              MongoDB Units            Rentals United API
```

---

## Database Design

### Buildings Collection
- Manually created by admin
- Contains: name, description, location, amenities, images
- Has many Units (one-to-many relationship)

### Units Collection
- Synced from Rentals United API
- Contains: all property details, images, amenities from RU
- Linked to Building via `buildingId` (ObjectId reference)
- Has `ruPropertyId` for real-time pricing API calls

---

## User Journey

### 1. Browse Properties
```
User visits /properties
  ↓
Frontend calls GET /api/buildings
  ↓
Backend fetches buildings from MongoDB with unit counts
  ↓
User sees building cards with location, amenities, unit count
```

### 2. View Units in Building
```
User clicks "View rooms" on a building
  ↓
Frontend navigates to /property/:buildingId
  ↓
Frontend calls GET /api/buildings/:buildingId
  ↓
Backend fetches building + all units from MongoDB
  ↓
User sees all units with images, descriptions, capacity
```

### 3. Book a Unit
```
User selects unit and dates
  ↓
Frontend calls POST /api/pricing/availability with ruPropertyId
  ↓
Backend calls Rentals United API for real-time pricing
  ↓
User sees current price and availability
  ↓
User completes booking
```

---

## Data Flow

### Building Creation (Admin)
```
1. Admin runs: node scripts/add-building.js
2. Script creates building in MongoDB
3. Returns building ObjectId
```

### Unit Sync (Admin)
```
1. Admin runs: node scripts/sync-units.js <buildingId> 41982
2. Script calls RU API: pullListProp(locationId) → gets property IDs
3. For each property:
   - Calls pullListSpecProp(propertyId) → gets full details
   - Parses XML response
   - Saves all fields to MongoDB with buildingId
4. Updates building's totalUnits count
```

### Real-time Pricing (User)
```
1. User selects dates on booking page
2. Frontend sends: { ruPropertyId, dateFrom, dateTo, guests }
3. Backend calls RU API: pullGetPropertyAvbPrice()
4. Returns current price and availability
```

---

## Key Technical Decisions

### Why Manual Buildings?
- Better organization and grouping of properties
- Custom building-level information (location, amenities)
- Not dependent on RU API structure

### Why Sync Units?
- Single source of truth (Rentals United)
- Automatic updates from property management system
- Real images from CDN
- Accurate property details

### Why Real-time Pricing?
- Always current prices
- Handles dynamic pricing rules
- Prevents booking conflicts
- Accurate availability

---

## API Endpoints

### Buildings
- `GET /api/buildings` - List all buildings with unit counts
- `GET /api/buildings/:id` - Get building with all units
- `POST /api/buildings` - Create new building
- `POST /api/buildings/:id/sync-units` - Sync units from RU API

### Pricing
- `POST /api/pricing/availability` - Get real-time pricing using ruPropertyId

---

## Rentals United Integration

### API Flow
1. **List Properties**: `pullListProp(locationId)` → Returns property IDs
2. **Get Details**: `pullListSpecProp(propertyId)` → Returns full property info
3. **Get Pricing**: `pullGetPropertyAvbPrice(propertyId, dates)` → Returns price

### XML Parsing
- RU API returns XML responses
- We use `fast-xml-parser` to parse
- Images are text content: `<Image>URL</Image>`
- Attributes prefixed with `@_`: `<Image ImageTypeID="1">`

### Location ID
- **41982**: HSR Layout, Bangalore (currently used)

---

## Current System State

**Database:**
- 1 Building: Modern HSR Layout Building (ID: `6905cc42e0bc63f00851513c`)
- 1 Unit: Modern Smart 2BHK Aparthotel (RU ID: `4017810`)
- 13 Images synced from RU API

**Setup Commands:**
```bash
# Add building
node scripts/add-building.js

# Sync units
node scripts/sync-units.js 6905cc42e0bc63f00851513c 41982

# Verify
node test-complete-flow.js
```

---

## Quick Reference

### Frontend Pages
- `/properties` - Shows all buildings
- `/property/:buildingId` - Shows units in building
- `/booking` - Booking flow with real-time pricing

### Key Files
- `models/Building.js` - Building schema
- `models/Unit.js` - Unit schema with RU fields
- `controllers/buildingController.js` - Building CRUD + sync logic
- `utils/ruClient.js` - Rentals United API client
- `scripts/sync-units.js` - Unit sync script

---

**Version**: 1.0  
**Last Updated**: November 1, 2025
