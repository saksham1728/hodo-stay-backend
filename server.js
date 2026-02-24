const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();

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
  startDailySyncJob();
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '2.0.0'
  });
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