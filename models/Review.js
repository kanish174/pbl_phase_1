const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  period: { type: String, required: true },
  ratings: [{
    criteria: { type: mongoose.Schema.Types.ObjectId, ref: 'Criteria' },
    score: { type: Number, min: 1, max: 5 },
    comment: String
  }],
  overallScore: Number,
  feedback: String,
  status: { type: String, enum: ['draft', 'completed'], default: 'draft' },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('Review', reviewSchema);