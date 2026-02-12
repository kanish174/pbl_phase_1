const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all projects (HR/Admin see all, employees see only their projects)
router.get('/', auth, async (req, res) => {
  try {
    const userRoles = req.user.roles || [req.user.role];
    const isHROrAdmin = userRoles.some(r => ['admin', 'hr'].includes(r));
    
    let projects;
    if (isHROrAdmin) {
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

// Create project (HR/Admin only)
router.post('/', auth, authorize(['admin', 'hr']), async (req, res) => {
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
    const { workDone, hoursSpent, status } = req.body;
    
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
    
    project.dailyLogs.push({
      employee: req.user._id,
      date: new Date(),
      workDone,
      hoursSpent: Number(hoursSpent),
      status
    });
    
    await project.save();
    
    return res.status(200).json({ 
      message: 'Daily log submitted successfully'
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

// Update project (HR/Admin only)
router.put('/:id', auth, authorize(['admin', 'hr']), async (req, res) => {
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

// Delete project (HR/Admin only)
router.delete('/:id', auth, authorize(['admin', 'hr']), async (req, res) => {
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

module.exports = router;
