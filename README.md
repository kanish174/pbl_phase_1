# Online Performance Review System

A web-based application for managing employee performance reviews with role-based access control.

## Features

- User authentication and authorization
- Role-based access (Admin, Manager, Employee)
- Performance criteria management
- Review creation and management
- Feedback system
- Responsive web interface

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install MongoDB and start the service

3. Update `.env` file with your configuration

4. Start the server:
```bash
npm start
```

5. Access the application at `http://localhost:3000`

## Default Roles

- **Admin**: Manage users, criteria, and system settings
- **Manager**: Create and manage performance reviews
- **Employee**: View personal reviews and feedback

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/users` - Get all users (Admin/Manager only)
- `POST /api/criteria` - Create criteria (Admin only)
- `GET /api/criteria` - Get all criteria
- `POST /api/reviews` - Create review (Manager/Admin only)
- `GET /api/reviews/employee/:id` - Get employee reviews

## Technology Stack

- Backend: Node.js, Express.js, MongoDB, JWT
- Frontend: HTML, CSS, JavaScript
- Database: MongoDB with Mongoose ODM