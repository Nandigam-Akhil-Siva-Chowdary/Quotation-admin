const mongoose = require('mongoose');
const User = require('../models/User');

const createAdminUser = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/sports-ground-quotation', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('Admin user already exists:');
      console.log('Username: admin');
      console.log('Password: (use the password you set previously)');
    } else {
      // Create new admin user
      const adminUser = new User({
        username: 'admin',
        password: 'admin123', // Change this to a secure password
        role: 'admin'
      });

      await adminUser.save();
      console.log('Admin user created successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
      console.log('IMPORTANT: Change the password in production!');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();