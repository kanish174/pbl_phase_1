# User Performance Dashboard - Feature Documentation

## Overview
The User Performance Dashboard is a comprehensive performance tracking system that displays employee metrics, achievements, and performance trends. The dashboard provides real-time synchronization between employee and HR views.

## Features

### 1. **Employee Name & Search Box**
- Displays the employee's name prominently at the top
- Includes a search box for filtering performance data
- Clean, professional header design

### 2. **Performance Level & Circular Score**
- Visual circular progress indicator showing overall performance score (0-100)
- Performance level badge (Excellent, Good, Average, Below Average, Poor)
- Color-coded based on performance level
- Editable by employee (own data) and HR/Admin (any employee)

### 3. **Key Performance Metrics**
Four main metrics displayed as cards:
- **Attendance** (0-100%)
- **Tasks Completion** (0-100%)
- **Teamwork** (0-100%)
- **Punctuality** (0-100%)

Each metric includes:
- Icon representation
- Percentage value
- Visual progress bar
- Edit button (for authorized users)

### 4. **Monthly Performance Graph**
- Bar chart showing performance trends over the last 12 months
- Visual representation of score progression
- Add new monthly data (HR/Admin/Manager only)
- Responsive design

### 5. **Achievements & Badges**
- Grid display of earned achievements
- Each badge shows:
  - Custom emoji icon
  - Achievement title
  - Date earned
- Add/delete achievements (authorized users)
- Click to view achievement details

## User Permissions

### Employee
- **View only** - Can view own performance dashboard
- **No edit access** - Cannot update any metrics or achievements
- Access via "My Performance" menu (only visible menu item)
- Dashboard shows "View Only" badge
- No access to main Dashboard section

### HR/Admin
- View any employee's performance dashboard
- Update any employee's metrics
- Add/delete achievements for any employee
- Add monthly performance data
- Full edit permissions
- Access via "Employees" section → "View Dashboard" button

### Manager
- View employee performance dashboards
- Add monthly performance data
- Add achievements for employees
- Limited editing capabilities

## Real-Time Synchronization

All updates made to the performance dashboard are immediately reflected across all views:
1. HR updates employee metrics → Employee sees the changes instantly on their dashboard
2. HR adds achievements → Visible to employee immediately
3. Manager adds monthly data → Reflected in all views
4. Employees have view-only access and cannot edit any data

## API Endpoints

### Get Performance Data
```
GET /api/performance/:userId
```
Returns complete performance dashboard data for a user.

### Update Performance Metrics
```
PUT /api/performance/:userId/metrics
```
Body: `{ performanceLevel, circularScore, attendance, tasks, teamwork, punctuality }`
Permissions: HR/Admin only

### Add Monthly Performance
```
POST /api/performance/:userId/monthly
```
Body: `{ month, score }`

### Add Achievement
```
POST /api/performance/:userId/achievements
```
Body: `{ title, description, icon }`
Permissions: HR/Admin/Manager only

### Delete Achievement
```
DELETE /api/performance/:userId/achievements/:achievementId
```

## Database Schema

### User Model Extensions
```javascript
performanceMetrics: {
  performanceLevel: String (Excellent, Good, Average, Below Average, Poor)
  circularScore: Number (0-100)
  attendance: Number (0-100)
  tasks: Number (0-100)
  teamwork: Number (0-100)
  punctuality: Number (0-100)
}

monthlyPerformance: [{
  month: String
  score: Number
  date: Date
}]

achievements: [{
  title: String
  description: String
  icon: String (emoji)
  earnedDate: Date
}]
```

## Usage Instructions

### For Employees
1. Login to your account
2. Automatically redirected to "My Performance" (only visible section)
3. View your performance metrics and achievements (read-only)
4. "View Only" badge displayed in header
5. No edit buttons visible

### For HR/Admin
1. Login to your account
2. Navigate to "Employees" section
3. Click "View Dashboard" for any employee
4. View complete performance data in modal
5. Edit metrics, add monthly data, or manage achievements
6. Changes are saved immediately and reflected everywhere

## Technical Implementation

### Frontend Files
- `public/dashboard.css` - Styling for performance dashboard
- `public/performance.js` - JavaScript functions for dashboard operations
- `public/index.html` - Updated with performance section
- `public/app.js` - Integrated navigation and section loading

### Backend Files
- `routes/performance.js` - API routes for performance operations
- `models/User.js` - Extended with performance fields
- `server.js` - Registered performance routes

## Responsive Design
The dashboard is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1024px - 1920px)
- Tablet (768px - 1024px)
- Mobile (320px - 768px)

## Color Coding

### Performance Levels
- **Excellent**: Green (#dcfce7)
- **Good**: Blue (#dbeafe)
- **Average**: Yellow (#fef3c7)
- **Below Average**: Orange (#fed7aa)
- **Poor**: Red (#fee2e2)

### Metrics
- **Attendance**: Blue gradient
- **Tasks**: Green gradient
- **Teamwork**: Yellow gradient
- **Punctuality**: Purple gradient

## Future Enhancements
- Real-time notifications when metrics are updated
- Export performance reports as PDF
- Performance comparison with team averages
- Goal setting and tracking
- Performance improvement suggestions
- Integration with review system for automatic score updates
