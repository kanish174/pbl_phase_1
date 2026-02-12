const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  startDate: { type: Date, required: true },
  endDate: Date,
  status: { 
    type: String, 
    enum: ['active', 'completed', 'on-hold', 'cancelled'], 
    default: 'active' 
  },
  teamMembers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  dailyLogs: {
    type: [{
      employee: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
      },
      date: { type: Date, required: true },
      workDone: { type: String, required: true },
      hoursSpent: { type: Number, required: true },
      status: { 
        type: String, 
        enum: ['completed', 'in-progress', 'blocked'], 
        default: 'in-progress' 
      },
      createdAt: { type: Date, default: Date.now }
    }],
    default: []
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', projectSchema);
