const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testLeaderboard() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/performance_review');
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({}).select('username department roles performanceMetrics');
    console.log(`Found ${users.length} users:`);
    
    users.forEach(user => {
      console.log(`- ${user.username}: roles=${user.roles}, metrics=${JSON.stringify(user.performanceMetrics)}`);
    });

    // Filter employees with scores
    const employees = users.filter(user => 
      user.roles && user.roles.includes('employee') && 
      user.performanceMetrics && 
      typeof user.performanceMetrics.circularScore === 'number' &&
      user.performanceMetrics.circularScore > 0
    );

    console.log(`\nEmployees with performance scores: ${employees.length}`);
    
    if (employees.length === 0) {
      console.log('\nNo employees have performance scores yet.');
      console.log('To test the leaderboard:');
      console.log('1. Login as HR user');
      console.log('2. Go to Employees section');
      console.log('3. View an employee dashboard');
      console.log('4. Edit their performance metrics');
      console.log('5. The leaderboard will then show data');
    } else {
      // Sort and create leaderboard
      employees.sort((a, b) => b.performanceMetrics.circularScore - a.performanceMetrics.circularScore);
      
      console.log('\nLeaderboard:');
      employees.slice(0, 10).forEach((user, index) => {
        console.log(`${index + 1}. ${user.username} - ${user.performanceMetrics.circularScore} points (${user.department || 'N/A'})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testLeaderboard();