const mongoose = require('mongoose');
const User = require('./models/User');

const initializeAdmin = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/sports-ground-quotation', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (!existingAdmin) {
      console.log('Creating admin user...');
      
      const adminUser = new User({
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });

      await adminUser.save();
      console.log('Admin user created successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
    } else {
      console.log('Admin user already exists.');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error initializing admin:', error);
    process.exit(1);
  }
};

initializeAdmin();