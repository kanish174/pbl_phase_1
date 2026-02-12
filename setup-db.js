const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function setupDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/performance_review');
        console.log('Connected to MongoDB');

        // Create default admin user if none exists
        const adminExists = await User.findOne({ roles: 'admin' });
        
        if (!adminExists) {
            const adminUser = new User({
                username: 'admin',
                email: 'admin@company.com',
                password: 'admin123',
                roles: ['admin'],
                department: 'IT'
            });
            
            await adminUser.save();
            console.log('Default admin user created:');
            console.log('Username: admin');
            console.log('Password: admin123');
        } else {
            console.log('Admin user already exists');
        }

        // Create sample users
        const sampleUsers = [
            {
                username: 'manager1',
                email: 'manager1@company.com',
                password: 'manager123',
                roles: ['manager'],
                department: 'Sales'
            },
            {
                username: 'employee1',
                email: 'employee1@company.com',
                password: 'employee123',
                roles: ['employee'],
                department: 'Sales'
            },
            {
                username: 'hr1',
                email: 'hr1@company.com',
                password: 'hr123',
                roles: ['hr'],
                department: 'Human Resources'
            }
        ];

        for (const userData of sampleUsers) {
            const existingUser = await User.findOne({ username: userData.username });
            if (!existingUser) {
                const user = new User(userData);
                await user.save();
                console.log(`Sample user created: ${userData.username}`);
            }
        }

        console.log('\nDatabase setup completed successfully!');
        console.log('You can now start the server with: npm start');
        
    } catch (error) {
        console.error('Database setup failed:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\nMongoDB is not running. Please:');
            console.log('1. Install MongoDB from https://www.mongodb.com/try/download/community');
            console.log('2. Start MongoDB service');
            console.log('3. Run this setup script again');
        }
    } finally {
        mongoose.connection.close();
    }
}

setupDatabase();