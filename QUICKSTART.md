# Quick Start Guide - Performance Review System

## Prerequisites
- Node.js (v14 or higher)
- MongoDB (running on localhost:27017)
- npm or yarn package manager

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
The `.env` file is already configured with default settings:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/performance_review
JWT_SECRET=your_secure_jwt_secret_key_change_this_in_production
SESSION_SECRET=your_secure_session_secret_key_change_this_in_production
NODE_ENV=development
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### 3. Start MongoDB
Make sure MongoDB is running on your system:

**Windows:**
```bash
net start MongoDB
```

**macOS/Linux:**
```bash
sudo systemctl start mongod
```

Or use MongoDB Compass to start the service.

### 4. Start the Server
```bash
npm start
```

The server will start on `http://localhost:5000`

## First Time Setup

### Create Admin Account
1. Open browser and go to `http://localhost:5000`
2. Click "Create new account"
3. Fill in the registration form:
   - Username: admin
   - Email: admin@example.com
   - Password: admin123
   - Department: Administration
4. Click "Create Account"

### Upgrade to Admin Role
Since the first user is created as an employee, you need to manually update the database:

**Option 1: Using MongoDB Compass**
1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Navigate to `performance_review` database → `users` collection
4. Find your user and edit the document
5. Change `roles: ["employee"]` to `roles: ["admin"]`
6. Save the document

**Option 2: Using MongoDB Shell**
```bash
mongosh
use performance_review
db.users.updateOne(
  { username: "admin" },
  { $set: { roles: ["admin"] } }
)
```

### Login as Admin
1. Logout and login again with admin credentials
2. You now have full access to all features

## Testing the Performance Dashboard

### As Employee
1. Register a new employee account
2. Login with employee credentials
3. Click "My Performance" in sidebar
4. Update your performance metrics
5. Add achievements

### As HR/Admin
1. Login with admin account
2. Navigate to "Employees" section
3. Click "View Dashboard" for any employee
4. Edit their performance metrics
5. Add monthly performance data
6. Manage achievements

## Sample Data Creation

### Create Test Employees
```javascript
// Register multiple employees through the UI or use this script
const employees = [
  { username: "john_doe", email: "john@example.com", password: "password123", department: "Engineering" },
  { username: "jane_smith", email: "jane@example.com", password: "password123", department: "Sales" },
  { username: "bob_wilson", email: "bob@example.com", password: "password123", department: "Marketing" }
];
```

### Add Performance Criteria
1. Login as admin
2. Go to "Forms" section
3. Add criteria:
   - Communication Skills
   - Technical Expertise
   - Leadership
   - Problem Solving
   - Time Management

### Create Performance Reviews
1. Go to Dashboard
2. Click "New Review"
3. Select employee
4. Enter review period (e.g., "Q1 2024")
5. Rate each criteria
6. Add feedback
7. Save review

## Troubleshooting

### MongoDB Connection Error
```
Error: MongoDB connection failed
```
**Solution:** Ensure MongoDB is running and accessible at `mongodb://localhost:27017`

### Port Already in Use
```
Error: Port 5000 is already in use
```
**Solution:** Change the PORT in `.env` file or kill the process using port 5000

### Session Issues
```
Error: Session store unavailable
```
**Solution:** Restart MongoDB and the Node.js server

### Cannot Edit Performance Metrics
**Solution:** Ensure you're logged in with appropriate role (employee for own data, HR/Admin for any employee)

## Default Ports
- Application: `http://localhost:5000`
- MongoDB: `mongodb://localhost:27017`

## Available Routes

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id/roles` - Update user roles (Admin only)

### Performance Dashboard
- `GET /api/performance/:userId` - Get performance data
- `PUT /api/performance/:userId/metrics` - Update metrics
- `POST /api/performance/:userId/monthly` - Add monthly data
- `POST /api/performance/:userId/achievements` - Add achievement
- `DELETE /api/performance/:userId/achievements/:achievementId` - Delete achievement

### Reviews
- `GET /api/reviews/all` - Get all reviews (Manager/Admin)
- `POST /api/reviews` - Create review
- `GET /api/reviews/employee/:id` - Get employee reviews
- `PUT /api/reviews/:id` - Update review

### Criteria
- `GET /api/criteria` - Get all criteria
- `POST /api/criteria` - Create criteria (Admin only)
- `PUT /api/criteria/:id` - Update criteria (Admin only)

## Features Overview

### Role-Based Access
- **Admin**: Full system access
- **Manager**: Create reviews, view employees
- **HR**: Manage employees, view/edit performance data
- **Employee**: View own data, update own metrics

### Performance Dashboard
- Circular performance score (0-100)
- Performance level badge
- 4 key metrics (Attendance, Tasks, Teamwork, Punctuality)
- Monthly performance graph
- Achievements & badges system

### Real-Time Updates
All performance data updates are immediately reflected across:
- Employee's own dashboard
- HR/Admin view of employee
- Any open modal windows

## Next Steps
1. Create multiple test users with different roles
2. Add performance criteria
3. Create performance reviews
4. Update employee performance metrics
5. Add achievements and monthly data
6. Explore the synchronized dashboard views

## Support
For issues or questions, refer to:
- `README.md` - General project information
- `PERFORMANCE_DASHBOARD.md` - Detailed dashboard documentation
- Check console logs for error messages
