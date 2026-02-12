const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get leaderboard data (MUST be before /:userId route)
router.get('/leaderboard/all', auth, async (req, res) => {
  try {
    const users = await User.find(
      { 'roles': 'employee', 'performanceMetrics.circularScore': { $gte: 0 } },
      'username department performanceMetrics.circularScore performanceMetrics.performanceLevel'
    ).sort({ 'performanceMetrics.circularScore': -1 }).limit(10).lean();
    
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      department: user.department || 'N/A',
      score: user.performanceMetrics.circularScore,
      level: user.performanceMetrics.performanceLevel || 'Average'
    }));
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get monthly leaderboard data
router.get('/leaderboard/monthly', auth, async (req, res) => {
  try {
    const { month } = req.query; // Format: YYYY-MM
    
    if (!month) {
      return res.status(400).json({ message: 'Month parameter required (YYYY-MM format)' });
    }
    
    // Find users with monthly performance data for the specified month
    const users = await User.find(
      { 
        'roles': 'employee',
        'monthlyPerformance': {
          $elemMatch: {
            'month': month
          }
        }
      },
      'username department monthlyPerformance'
    ).lean();
    
    const leaderboard = users.map(user => {
      const monthData = user.monthlyPerformance.find(mp => mp.month === month);
      return {
        username: user.username,
        department: user.department || 'N/A',
        score: monthData ? monthData.score : 0
      };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Monthly leaderboard error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user performance dashboard data
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check permissions: user can view own data, HR/Admin/Manager can view any
    if (userId !== req.user._id.toString() && 
        !req.user.hasAnyRole(['admin', 'manager', 'hr'])) {
      return res.status(403).json({ message: 'Access forbidden' });
    }
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      username: user.username,
      email: user.email,
      department: user.department,
      performanceMetrics: user.performanceMetrics || {},
      monthlyPerformance: user.monthlyPerformance || [],
      achievements: user.achievements || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update performance metrics (Only HR/Admin can update)
router.put('/:userId/metrics', auth, authorize(['admin', 'hr']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { attendance, tasks, teamwork, punctuality } = req.body;
    
    console.log('Updating metrics for user:', userId);
    console.log('Received data:', { attendance, tasks, teamwork, punctuality });
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Current metrics:', user.performanceMetrics);
    
    // Initialize if needed
    if (!user.performanceMetrics) {
      user.performanceMetrics = {};
    }
    
    // Update metrics
    if (attendance !== undefined) user.performanceMetrics.attendance = Number(attendance);
    if (tasks !== undefined) user.performanceMetrics.tasks = Number(tasks);
    if (teamwork !== undefined) user.performanceMetrics.teamwork = Number(teamwork);
    if (punctuality !== undefined) user.performanceMetrics.punctuality = Number(punctuality);
    
    // Calculate overall score
    const att = user.performanceMetrics.attendance || 0;
    const tsk = user.performanceMetrics.tasks || 0;
    const team = user.performanceMetrics.teamwork || 0;
    const punct = user.performanceMetrics.punctuality || 0;
    
    user.performanceMetrics.circularScore = Math.round((att + tsk + team + punct) / 4);
    
    // Set performance level
    const score = user.performanceMetrics.circularScore;
    if (score >= 90) user.performanceMetrics.performanceLevel = 'Excellent';
    else if (score >= 75) user.performanceMetrics.performanceLevel = 'Good';
    else if (score >= 60) user.performanceMetrics.performanceLevel = 'Average';
    else if (score >= 40) user.performanceMetrics.performanceLevel = 'Below Average';
    else user.performanceMetrics.performanceLevel = 'Poor';
    
    user.markModified('performanceMetrics');
    await user.save();
    
    console.log('Updated metrics:', user.performanceMetrics);
    
    res.json({ 
      message: 'Performance metrics updated successfully',
      performanceMetrics: user.performanceMetrics 
    });
  } catch (error) {
    console.error('Error updating metrics:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add monthly performance data
router.post('/:userId/monthly', auth, authorize(['admin', 'hr', 'manager']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, score } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.monthlyPerformance.push({ month, score, date: new Date() });
    await user.save();
    
    res.json({ 
      message: 'Monthly performance added',
      monthlyPerformance: user.monthlyPerformance 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add achievement/badge (Only HR/Admin/Manager can add)
router.post('/:userId/achievements', auth, authorize(['admin', 'hr', 'manager']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, description, icon } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.achievements.push({ title, description, icon, earnedDate: new Date() });
    await user.save();
    
    res.json({ 
      message: 'Achievement added',
      achievements: user.achievements 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete achievement
router.delete('/:userId/achievements/:achievementId', auth, authorize(['admin', 'hr']), async (req, res) => {
  try {
    const { userId, achievementId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.achievements = user.achievements.filter(a => a._id.toString() !== achievementId);
    await user.save();
    
    res.json({ message: 'Achievement deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
