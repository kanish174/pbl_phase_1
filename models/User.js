const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mustChangePassword: { type: Boolean, default: false },
  roles: [{ 
    type: String, 
    enum: ['hr', 'employee'], 
    default: ['employee'] 
  }],
  role: { 
    type: String, 
    enum: ['hr', 'employee'], 
    default: 'employee',
    get: function() {
      return this.roles && this.roles.length > 0 ? this.roles[0] : 'employee';
    }
  },
  department: String,
  // Performance Dashboard Data
  performanceMetrics: {
    type: {
      performanceLevel: { type: String, enum: ['Excellent', 'Good', 'Average', 'Below Average', 'Poor'], default: 'Average' },
      circularScore: { type: Number, default: 0, min: 0, max: 100 },
      attendance: { type: Number, default: 0, min: 0, max: 100 },
      tasks: { type: Number, default: 0, min: 0, max: 100 },
      teamwork: { type: Number, default: 0, min: 0, max: 100 },
      punctuality: { type: Number, default: 0, min: 0, max: 100 },
      monthlyResetKey: { type: String, default: '' }
    },
    default: () => ({
      performanceLevel: 'Average',
      circularScore: 0,
      attendance: 0,
      tasks: 0,
      teamwork: 0,
      punctuality: 0,
      monthlyResetKey: ''
    })
  },
  monthlyPerformance: [{
    month: String,
    score: Number,
    date: { type: Date, default: Date.now }
  }],
  achievements: [{
    title: String,
    description: String,
    icon: String,
    earnedDate: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to sync roles and role fields
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  
  // Sync roles array with single role field for backward compatibility
  if (this.isModified('roles') && this.roles && this.roles.length > 0) {
    this.set('role', this.roles[0], { strict: false });
  } else if (this.isModified('role') && this.role) {
    if (!this.roles || this.roles.length === 0) {
      this.roles = [this.role];
    }
  }
  
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Method to check if user has a specific role
userSchema.methods.hasRole = function(role) {
  return this.roles && this.roles.includes(role);
};

// Method to check if user has any of the specified roles
userSchema.methods.hasAnyRole = function(roles) {
  return this.roles && roles.some(role => this.roles.includes(role));
};

module.exports = mongoose.model('User', userSchema);
