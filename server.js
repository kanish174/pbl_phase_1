const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');
const criteriaRoutes = require('./routes/criteria');
const notificationRoutes = require('./routes/notifications');
const projectRoutes = require('./routes/projects');
const performanceRoutes = require('./routes/performance');
const leaveRoutes = require('./routes/leaves');

const app = express();

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB with fallback
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/performance_review');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.log('MongoDB connection failed, running without database');
    console.log('Error:', error.message);
  }
};

connectDB();

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/performance_review',
    touchAfter: 24 * 3600
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/criteria', criteriaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/leaves', leaveRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  if (!res.headersSent) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
  if (process.env.GOOGLE_CLIENT_ID) {
    console.log('Google employee login: ENABLED');
  } else {
    console.log('Google employee login: DISABLED (set GOOGLE_CLIENT_ID in .env)');
  }
});
