const express = require('express');
const User = require('../models/User');
const Leave = require('../models/Leave');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function getPerformanceLevelFromScore(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function upsertMonthlyPerformanceEntry(user, monthKey, score) {
  if (!user) return false;

  if (!Array.isArray(user.monthlyPerformance)) {
    user.monthlyPerformance = [];
  }

  const normalizedScore = clampScore(score);
  const existingEntry = user.monthlyPerformance.find((entry) => entry.month === monthKey);

  if (existingEntry) {
    const currentScore = clampScore(existingEntry.score);
    if (currentScore === normalizedScore) {
      return false;
    }
    existingEntry.score = normalizedScore;
    existingEntry.date = new Date();
    user.markModified('monthlyPerformance');
    return true;
  }

  user.monthlyPerformance.push({
    month: monthKey,
    score: normalizedScore,
    date: new Date()
  });
  user.markModified('monthlyPerformance');
  return true;
}

function countLeaveDaysInYear(startDate, endDate, year) {
  const leaveStartUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  const leaveEndUtc = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  );
  const yearStartUtc = Date.UTC(year, 0, 1);
  const yearEndUtc = Date.UTC(year, 11, 31);

  const overlapStart = Math.max(leaveStartUtc, yearStartUtc);
  const overlapEnd = Math.min(leaveEndUtc, yearEndUtc);

  if (overlapStart > overlapEnd) {
    return 0;
  }

  return Math.floor((overlapEnd - overlapStart) / ONE_DAY_MS) + 1;
}

async function calculateAttendanceFromApprovedLeaves(userId, year) {
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const approvedLeaves = await Leave.find({
    employee: userId,
    status: 'approved',
    startDate: { $lte: yearEnd },
    endDate: { $gte: yearStart }
  }).select('startDate endDate').lean();

  const leaveDays = approvedLeaves.reduce((total, leave) => {
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);
    return total + countLeaveDaysInYear(startDate, endDate, year);
  }, 0);

  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 366 : 365;
  return clampScore(Math.round(((daysInYear - leaveDays) / daysInYear) * 100));
}

async function syncDynamicAttendanceAndScore(user) {
  if (!user) return false;

  if (!user.performanceMetrics) {
    user.performanceMetrics = {};
  }

  const year = new Date().getFullYear();
  const dynamicAttendance = await calculateAttendanceFromApprovedLeaves(user._id, year);

  const tasks = clampScore(user.performanceMetrics.tasks);
  const teamwork = clampScore(user.performanceMetrics.teamwork);
  const punctuality = clampScore(user.performanceMetrics.punctuality);
  const circularScore = clampScore(Math.round((dynamicAttendance + tasks + teamwork + punctuality) / 4));
  const performanceLevel = getPerformanceLevelFromScore(circularScore);

  const currentAttendance = clampScore(user.performanceMetrics.attendance);
  const currentScore = clampScore(user.performanceMetrics.circularScore);
  const currentLevel = user.performanceMetrics.performanceLevel || '';
  const currentMonthKey = getCurrentMonthKey();

  const hasChanges =
    currentAttendance !== dynamicAttendance ||
    currentScore !== circularScore ||
    currentLevel !== performanceLevel;
  const hasMonthlyChanges = upsertMonthlyPerformanceEntry(user, currentMonthKey, circularScore);

  if (hasChanges) {
    user.performanceMetrics.attendance = dynamicAttendance;
    user.performanceMetrics.circularScore = circularScore;
    user.performanceMetrics.performanceLevel = performanceLevel;
    user.markModified('performanceMetrics');
  }

  if (hasChanges || hasMonthlyChanges) {
    await user.save();
  }

  return hasChanges || hasMonthlyChanges;
}

async function resetMonthlyMetricsIfNeeded(user) {
  if (!user) return false;

  if (!user.performanceMetrics) {
    user.performanceMetrics = {};
  }

  const currentMonthKey = getCurrentMonthKey();
  const previousMonthKey = user.performanceMetrics.monthlyResetKey || '';

  // First-time initialization: set key only, no reset/snapshot needed.
  if (!previousMonthKey) {
    user.performanceMetrics.monthlyResetKey = currentMonthKey;
    upsertMonthlyPerformanceEntry(user, currentMonthKey, Number(user.performanceMetrics.circularScore || 0));
    user.markModified('performanceMetrics');
    await user.save();
    return true;
  }

  if (previousMonthKey === currentMonthKey) {
    return false;
  }

  // Save previous month score snapshot once before resetting.
  if (!Array.isArray(user.monthlyPerformance)) {
    user.monthlyPerformance = [];
  }

  const alreadySnapshotted = user.monthlyPerformance.some(mp => mp.month === previousMonthKey);
  if (!alreadySnapshotted) {
    user.monthlyPerformance.push({
      month: previousMonthKey,
      score: Number(user.performanceMetrics.circularScore || 0),
      date: new Date()
    });
  }

  // Monthly metrics reset. Attendance is intentionally not reset.
  user.performanceMetrics.tasks = 0;
  user.performanceMetrics.teamwork = 0;
  user.performanceMetrics.punctuality = 0;
  user.performanceMetrics.circularScore = 0;
  user.performanceMetrics.performanceLevel = 'Average';
  user.performanceMetrics.monthlyResetKey = currentMonthKey;
  upsertMonthlyPerformanceEntry(user, currentMonthKey, 0);

  user.markModified('performanceMetrics');
  await user.save();
  return true;
}

// Get leaderboard data (MUST be before /:userId route)
router.get('/leaderboard/all', auth, async (req, res) => {
  try {
    const users = await User.find(
      { 'roles': 'employee' },
      'username department performanceMetrics monthlyPerformance'
    );

    for (const user of users) {
      await resetMonthlyMetricsIfNeeded(user);
      await syncDynamicAttendanceAndScore(user);
    }

    const leaderboard = users
      .sort((a, b) => (b.performanceMetrics?.circularScore || 0) - (a.performanceMetrics?.circularScore || 0))
      .slice(0, 10)
      .map((user, index) => ({
      rank: index + 1,
      username: user.username,
      department: user.department || 'N/A',
      score: user.performanceMetrics?.circularScore || 0,
      level: user.performanceMetrics?.performanceLevel || 'Average'
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
    
    // Check permissions: user can view own data, HR can view any
    if (userId !== req.user._id.toString() && 
        !req.user.hasAnyRole(['hr'])) {
      return res.status(403).json({ message: 'Access forbidden' });
    }
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await resetMonthlyMetricsIfNeeded(user);
    await syncDynamicAttendanceAndScore(user);
    
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

// Update performance metrics (Only HR can update)
router.put('/:userId/metrics', auth, authorize(['hr']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { attendance, tasks, teamwork, punctuality } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await resetMonthlyMetricsIfNeeded(user);
    
    // Initialize if needed
    if (!user.performanceMetrics) {
      user.performanceMetrics = {};
    }
    
    // Update metrics
    if (attendance !== undefined) user.performanceMetrics.attendance = Number(attendance);
    if (tasks !== undefined) user.performanceMetrics.tasks = Number(tasks);
    if (teamwork !== undefined) user.performanceMetrics.teamwork = Number(teamwork);
    if (punctuality !== undefined) user.performanceMetrics.punctuality = Number(punctuality);

    user.performanceMetrics.monthlyResetKey = getCurrentMonthKey();

    const year = new Date().getFullYear();
    const dynamicAttendance = await calculateAttendanceFromApprovedLeaves(user._id, year);
    const tsk = clampScore(user.performanceMetrics.tasks);
    const team = clampScore(user.performanceMetrics.teamwork);
    const punct = clampScore(user.performanceMetrics.punctuality);

    user.performanceMetrics.attendance = dynamicAttendance;
    user.performanceMetrics.circularScore = clampScore(Math.round((dynamicAttendance + tsk + team + punct) / 4));
    user.performanceMetrics.performanceLevel = getPerformanceLevelFromScore(user.performanceMetrics.circularScore);
    upsertMonthlyPerformanceEntry(user, getCurrentMonthKey(), user.performanceMetrics.circularScore);

    user.markModified('performanceMetrics');
    await user.save();
    
    res.json({ 
      message: 'Performance metrics updated successfully',
      performanceMetrics: user.performanceMetrics 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add monthly performance data
router.post('/:userId/monthly', auth, authorize(['hr']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, score } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    upsertMonthlyPerformanceEntry(user, month, score);
    await user.save();
    
    res.json({ 
      message: 'Monthly performance added',
      monthlyPerformance: user.monthlyPerformance 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add achievement/badge (Only HR can add)
router.post('/:userId/achievements', auth, authorize(['hr']), async (req, res) => {
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
router.delete('/:userId/achievements/:achievementId', auth, authorize(['hr']), async (req, res) => {
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
