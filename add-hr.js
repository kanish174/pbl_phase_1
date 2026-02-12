const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function addHR() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/performance-review');
        
        const hrData = {
            username: 'hr2',
            email: 'hr2@company.com',
            password: 'hr123',
            roles: ['hr'],
            department: 'Human Resources'
        };
        
        const existingUser = await User.findOne({ username: hrData.username });
        if (existingUser) {
            console.log('HR user already exists!');
            process.exit(0);
        }
        
        const user = new User(hrData);
        await user.save();
        
        console.log('HR account created successfully!');
        console.log('Username:', hrData.username);
        console.log('Password:', hrData.password);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

addHR();
