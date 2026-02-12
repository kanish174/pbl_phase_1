const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

console.log('Starting test server...');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/performance_review')
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.log('✗ MongoDB error:', err.message));

app.use(express.json());
app.use(express.static('public'));

app.get('/test', (req, res) => {
  res.json({ status: 'Server is working!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop');
});
