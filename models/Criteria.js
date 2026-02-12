const mongoose = require('mongoose');

const criteriaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  weight: { type: Number, default: 1 },
  department: String,
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Criteria', criteriaSchema);