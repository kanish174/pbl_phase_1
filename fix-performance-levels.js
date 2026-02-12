const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function updatePerformanceLevels() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/performance-review');
        
        const employees = await User.find({ roles: 'employee' });
        
        for (const employee of employees) {
            const score = employee.performanceMetrics.circularScore || 0;
            
            if (score >= 90) {
                employee.performanceMetrics.performanceLevel = 'Excellent';
            } else if (score >= 75) {
                employee.performanceMetrics.performanceLevel = 'Good';
            } else if (score >= 60) {
                employee.performanceMetrics.performanceLevel = 'Average';
            } else if (score >= 40) {
                employee.performanceMetrics.performanceLevel = 'Below Average';
            } else {
                employee.performanceMetrics.performanceLevel = 'Poor';
            }
            
            await employee.save();
            console.log(`Updated ${employee.username}: Score ${score} -> ${employee.performanceMetrics.performanceLevel}`);
        }
        
        console.log('\nAll employee performance levels updated!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updatePerformanceLevels();
