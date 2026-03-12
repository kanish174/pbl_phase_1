const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function upsertUserRole() {
  try {
    // Keep DB default in sync with server.js/.env
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/performance_review';
    await mongoose.connect(mongoUri);

    const action = process.argv[2];
    let username = process.argv[2] || 'kanish33';
    let normalizedRole = process.argv[3] || 'hr';

    if (action === '--delete') {
      username = process.argv[3];
      if (!username) {
        console.error('Usage: node add-hr.js --delete <username>');
        process.exit(1);
      }
      const result = await User.deleteOne({ username });
      if (result.deletedCount > 0) {
        console.log(`Deleted user "${username}".`);
      } else {
        console.log(`User "${username}" not found.`);
      }
      process.exit(0);
    }

    if (action === '--normalize') {
      const hrUsername = process.argv[3] || 'hr1';
      await User.updateMany(
        { username: { $ne: hrUsername } },
        { $set: { roles: ['employee'] } }
      );
      await User.updateOne(
        { username: hrUsername },
        { $set: { roles: ['hr'] } },
        { upsert: false }
      );
      await User.deleteOne({ username: 'admin1' });
      console.log(`Normalized roles: "${hrUsername}" is HR, all others are employee, and "admin1" removed if present.`);
      process.exit(0);
    }

    const validRoles = ['hr', 'employee'];
    if (!validRoles.includes(normalizedRole)) {
      console.error(`Invalid role "${normalizedRole}". Valid roles: ${validRoles.join(', ')}`);
      process.exit(1);
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      existingUser.roles = [normalizedRole];
      await existingUser.save();
      console.log(`Updated user "${username}" to role "${normalizedRole}".`);
      process.exit(0);
    }

    const defaultPassword = normalizedRole === 'hr' ? 'hr123' : 'employee123';
    const user = new User({
      username,
      email: `${username}@example.com`,
      password: defaultPassword,
      roles: [normalizedRole],
      department: normalizedRole === 'hr' ? 'Human Resources' : 'Administration'
    });

    await user.save();

    console.log(`Created new ${normalizedRole} user.`);
    console.log('Username:', username);
    console.log('Password:', defaultPassword);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message || error);
    process.exit(1);
  }
}

upsertUserRole();
