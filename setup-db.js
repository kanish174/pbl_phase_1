const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function setupDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/performance_review');
        console.log('Connected to MongoDB');

        // Create sample users (HR + employees only)
        const sampleUsers = [
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
