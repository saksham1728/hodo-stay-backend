const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();

// Trust proxy - Required for Render and other reverse proxies
// This allows express-rate-limit to correctly identify users by IP
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://hodo-stay.onrender.com', 'https://www.hodostays.com', 'https://hodostays.com'] 
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:8080', 'https://hodo-stay.onrender.com', 'https://www.hodostays.com', 'https://hodostays.com'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000
})
.then(async () => {
  console.log('✅ MongoDB connected successfully');
  console.log(`📍 Database: ${mongoose.connection.name}`);
  
  // Check cache and warm if needed
  const PropertyDailyCache = require('./models/PropertyDailyCache');
  const cacheCount = await PropertyDailyCache.countDocuments();
  
  if (cacheCount === 0) {
    console.log('🔥 Cache is empty. Running initial sync...');
    const propertyCacheSync = require('./services/propertyCacheSync');
    try {
      await propertyCacheSync.syncAllUnits();
      console.log('✅ Initial cache sync completed');
    } catch (error) {
      console.error('⚠️  Initial cache sync failed:', error.message);
    }
  } else {
    console.log(`📊 Cache has ${cacheCount} records`);
  }
  
  // Start daily cache sync job
  const { startDailySyncJob } = require('./jobs/dailyCacheSync');
  global.cronJobInfo = startDailySyncJob();
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Health check route
app.get('/health', (req, res) => {
  // Optional: Uncomment to see keep-alive pings in logs
  console.log('💓 Health check ping');
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '2.0.0'
  });
});

// Cron job status route
app.get('/api/cron-status', async (req, res) => {
  try {
    const PropertyDailyCache = require('./models/PropertyDailyCache');
    
    // Get most recent cache record
    const latestCache = await PropertyDailyCache.findOne().sort({ lastSynced: -1 });
    
    // Get cache statistics
    const totalRecords = await PropertyDailyCache.countDocuments();
    const Unit = require('./models/Unit');
    const activeUnits = await Unit.countDocuments({ isActive: true, ruPropertyId: { $exists: true, $ne: null } });
    
    const cronInfo = global.cronJobInfo || {};
    
    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cronJob: {
        isRunning: cronInfo.isRunning ? cronInfo.isRunning() : 'unknown',
        lastSyncTime: cronInfo.getLastSync ? cronInfo.getLastSync() : null,
        lastSyncResult: cronInfo.getLastResult ? cronInfo.getLastResult() : null,
        nextScheduledRun: cronInfo.getNextRun ? cronInfo.getNextRun() : null
      },
      cache: {
        totalRecords,
        activeUnits,
        expectedRecords: activeUnits * 181,
        coverage: activeUnits > 0 ? ((totalRecords / (activeUnits * 181)) * 100).toFixed(2) + '%' : '0%',
        latestSync: latestCache ? latestCache.lastSynced : null,
        latestSyncAge: latestCache ? Math.floor((Date.now() - latestCache.lastSynced.getTime()) / (1000 * 60 * 60)) + ' hours ago' : 'never'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hodo Stay Backend API v2.0 - Complete Booking Platform',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      buildings: '/api/buildings',
      units: '/api/units',
      users: '/api/users',
      bookings: '/api/bookings',
      health: '/health'
    }
  });
});

// API Routes
app.use('/api/buildings', require('./routes/buildings'));
app.use('/api/units', require('./routes/units'));
app.use('/api/users', require('./routes/users'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/coupons', require('./routes/coupons'));

// Manual cache sync trigger (for testing/admin)
app.post('/api/admin/trigger-sync', async (req, res) => {
  try {
    console.log('🔄 Manual cache sync triggered');
    const propertyCacheSync = require('./services/propertyCacheSync');
    const startTime = Date.now();
    
    const result = await propertyCacheSync.syncAllUnits();
    await propertyCacheSync.cleanupOldData();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Update global cron info
    if (global.cronJobInfo && global.cronJobInfo.getLastSync) {
      // This will be updated by the cron job itself
    }
    
    res.json({
      success: true,
      message: 'Cache sync completed successfully',
      result: {
        successCount: result.successCount,
        errorCount: result.errorCount,
        duration: duration + 's',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
});

module.exports = app;