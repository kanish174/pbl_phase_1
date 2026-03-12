const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const Leave = require('../models/Leave');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

const REJECT_REASON_TEAMWORK_PENALTY = 10;
const REJECT_REASON_PUNCTUALITY_PENALTY = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function recalculatePerformanceLevel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
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

// Get all projects (HR see all, employees see only their projects)
router.get('/', auth, async (req, res) => {
  try {
    const userRoles = req.user.roles || [req.user.role];
    const isHR = userRoles.includes('hr');
    
    let projects;
    if (isHR) {
      projects = await Project.find()
        .populate('teamMembers', 'username email')
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 });
    } else {
      projects = await Project.find({ teamMembers: req.user._id })
        .populate('teamMembers', 'username email')
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 });
    }
    
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create project (HR only)
router.post('/', auth, authorize(['hr']), async (req, res) => {
  try {
    const { name, description, startDate, endDate, teamMembers } = req.body;
    
    // Validate required fields
    if (!name || !startDate) {
      return res.status(400).json({ message: 'Name and start date are required' });
    }
    
    // Ensure user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User authentication required' });
    }
    
    const project = new Project({
      name,
      description,
      startDate,
      endDate,
      teamMembers,
      createdBy: req.user._id
    });
    
    await project.save();
    await project.populate('teamMembers', 'username email');
    
    res.status(201).json({ 
      message: 'Project created successfully',
      project 
    });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Add daily log (Team members only) - MUST BE BEFORE /:id route
router.post('/:id/logs', auth, async (req, res) => {
  try {
    const { workDone, hoursSpent, status, missedReason } = req.body;
    
    if (!workDone || !hoursSpent || !status) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    if (!project.dailyLogs) {
      project.dailyLogs = [];
    }
    
    const isTeamMember = project.teamMembers.some(id => id.toString() === req.user._id.toString());
    if (!isTeamMember) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingLog = project.dailyLogs.find(log => {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);
      return logDate.getTime() === today.getTime() && 
             log.employee.toString() === req.user._id.toString();
    });
    
    if (existingLog) {
      return res.status(400).json({ message: 'You have already submitted a log for today' });
    }
    
    // Check if deadline passed
    let missedDeadline = false;
    if (project.logDeadline && project.logDeadline.date) {
      const deadlineDate = new Date(project.logDeadline.date);
      const [hours, minutes] = (project.logDeadline.time || '23:59').split(':');
      deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      if (new Date() > deadlineDate) {
        missedDeadline = true;
        if (!missedReason) {
          return res.status(400).json({ 
            message: 'Deadline passed. Please provide a reason for late submission.',
            deadlinePassed: true
          });
        }
      }
    }
    
    project.dailyLogs.push({
      employee: req.user._id,
      date: new Date(),
      workDone,
      hoursSpent: Number(hoursSpent),
      status,
      missedDeadline,
      missedReason: missedReason || null,
      reasonApproved: false,
      reasonReviewStatus: missedDeadline ? 'pending' : 'not_required'
    });
    
    await project.save();
    
    return res.status(200).json({ 
      message: missedDeadline ? 'Log submitted. Waiting for HR approval.' : 'Daily log submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting log:', error);
    return res.status(500).json({ message: error.message || 'Error submitting log' });
  }
});

// Get project logs
router.get('/:id/logs', auth, async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    
    const project = await Project.findById(req.params.id)
      .populate('dailyLogs.employee', 'username email');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    let logs = project.dailyLogs;
    
    if (startDate) {
      logs = logs.filter(log => new Date(log.date) >= new Date(startDate));
    }
    if (endDate) {
      logs = logs.filter(log => new Date(log.date) <= new Date(endDate));
    }
    if (employeeId) {
      logs = logs.filter(log => log.employee._id.toString() === employeeId);
    }
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single project
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('teamMembers', 'username email')
      .populate('createdBy', 'username')
      .populate('dailyLogs.employee', 'username email');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update project (HR only)
router.put('/:id', auth, authorize(['hr']), async (req, res) => {
  try {
    const { name, description, startDate, endDate, teamMembers, status } = req.body;
    
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { name, description, startDate, endDate, teamMembers, status, updatedAt: Date.now() },
      { new: true }
    ).populate('teamMembers', 'username email');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ 
      message: 'Project updated successfully',
      project 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete project (HR only)
router.delete('/:id', auth, authorize(['hr']), async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set deadline for daily logs (HR only)
router.put('/:id/deadline', auth, authorize(['hr']), async (req, res) => {
  try {
    const { date, time, message } = req.body;
    
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    project.logDeadline = { date, time, message };
    await project.save();
    
    res.json({ 
      message: 'Deadline set successfully',
      deadline: project.logDeadline
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve missed log reason (HR only)
router.put('/:id/logs/:logId/approve', auth, authorize(['hr']), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const log = project.dailyLogs.id(req.params.logId);
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }
    
    log.reasonApproved = true;
    log.reasonReviewStatus = 'approved';
    await project.save();
    
    res.json({ message: 'Late submission reason approved.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reject missed log reason (HR only)
router.put('/:id/logs/:logId/reject', auth, authorize(['hr']), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const log = project.dailyLogs.id(req.params.logId);
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    if (!log.missedDeadline) {
      return res.status(400).json({ message: 'This log is not a missed-deadline submission.' });
    }

    const currentReviewStatus = log.reasonReviewStatus || (log.reasonApproved ? 'approved' : 'pending');
    if (currentReviewStatus === 'rejected') {
      return res.json({ message: 'Reason already rejected. Penalty already applied.' });
    }
    if (currentReviewStatus === 'approved') {
      return res.status(400).json({ message: 'This reason is already approved and cannot be rejected now.' });
    }
    
    log.reasonApproved = false;
    log.reasonReviewStatus = 'rejected';
    await project.save();

    // Apply penalty to employee metrics when HR rejects missed-deadline reason.
    const employee = await User.findById(log.employee);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found for this log' });
    }

    if (!employee.performanceMetrics) {
      employee.performanceMetrics = {};
    }

    const currentPunctuality = Number(employee.performanceMetrics.punctuality || 0);
    const currentTeamwork = Number(employee.performanceMetrics.teamwork || 0);
    const tasks = Number(employee.performanceMetrics.tasks || 0);
    const year = new Date().getFullYear();
    const attendance = await calculateAttendanceFromApprovedLeaves(employee._id, year);

    employee.performanceMetrics.punctuality = Math.max(0, currentPunctuality - REJECT_REASON_PUNCTUALITY_PENALTY);
    employee.performanceMetrics.teamwork = Math.max(0, currentTeamwork - REJECT_REASON_TEAMWORK_PENALTY);
    employee.performanceMetrics.attendance = attendance;
    employee.performanceMetrics.circularScore = clampScore(Math.round(
      (attendance + tasks + employee.performanceMetrics.teamwork + employee.performanceMetrics.punctuality) / 4
    ));
    employee.performanceMetrics.performanceLevel = recalculatePerformanceLevel(employee.performanceMetrics.circularScore);

    employee.markModified('performanceMetrics');
    await employee.save();
    
    res.json({
      message: `Late submission reason rejected. Teamwork and punctuality reduced by ${REJECT_REASON_TEAMWORK_PENALTY} each.`,
      penalties: {
        teamwork: REJECT_REASON_TEAMWORK_PENALTY,
        punctuality: REJECT_REASON_PUNCTUALITY_PENALTY
      },
      performanceMetrics: employee.performanceMetrics
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
