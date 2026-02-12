# Performance Review System - Setup Instructions

## Quick Start (Without MongoDB)

The system can run without MongoDB for testing purposes:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Access the application:**
   Open http://localhost:3001 in your browser

4. **Create an account:**
   - Click "Create new account"
   - Fill in the form (select at least one role)
   - Note: Without MongoDB, registration will show an error, but you can still test the UI

## Full Setup (With MongoDB)

For full functionality including user registration and data persistence:

1. **Install MongoDB:**
   - Download from https://www.mongodb.com/try/download/community
   - Install and start MongoDB service

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup database with sample data:**
   ```bash
   npm run setup
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Login with sample accounts:**
   - **Admin:** username: `admin`, password: `admin123`
   - **Manager:** username: `manager1`, password: `manager123`
   - **Employee:** username: `employee1`, password: `employee123`
   - **HR:** username: `hr1`, password: `hr123`

## Features

- **Role-based access control** (Admin, Manager, HR, Employee)
- **User authentication** with sessions and JWT
- **Performance review management**
- **Criteria management**
- **Dashboard with analytics**
- **Responsive design**

## Default Roles & Permissions

- **Admin:** Full system access, user management, criteria management
- **Manager:** Create/manage reviews, view employees
- **HR:** User management, view all reviews
- **Employee:** View personal reviews only

## Troubleshooting

### Registration not working
- Ensure MongoDB is running
- Check console for error messages
- Verify database connection in server logs

### Cannot access certain features
- Check your user role permissions
- Admin users have full access
- Employees can only view their own reviews

### Server won't start
- Check if port 3001 is available
- Verify all dependencies are installed
- Check .env file configuration

## Environment Variables

Create a `.env` file with:
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/performance_review
JWT_SECRET=your_secure_jwt_secret_key
SESSION_SECRET=your_secure_session_secret_key
NODE_ENV=development
```