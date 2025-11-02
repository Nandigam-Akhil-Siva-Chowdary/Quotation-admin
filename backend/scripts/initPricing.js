const mongoose = require('mongoose');
const Pricing = require('../models/Pricing');

const initializePricing = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/sports-ground-quotation', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const existingPricing = await Pricing.findOne({ category: 'default' });
    
    if (!existingPricing) {
      console.log('Creating default pricing data...');
      
      const defaultPricing = new Pricing({
        category: 'default',
        subbase: {
          concrete: 1500,
          asphalt: 1200
        },
        edgewall: 800,
        drainage: 450,
        fencing: {
          chainlink: 1200,
          metal: 1800,
          garnware: 2200,
          aluminium: 2800
        },
        flooring: {
          wooden: 3500,
          pvc: 2800,
          acrylic: 2200,
          rubber: 3200
        },
        lighting: {
          standard: 5000,
          neon: 8000,
          antiglare: 6500,
          long: 7200
        },
        equipment: {
          'basketball-hoop': 15000,
          'basketball-backboard': 8000,
          'football-goalpost': 25000,
          'tennis-net': 15000,
          'badminton-net': 8000,
          'badminton-posts': 12000,
          'cricket-stumps': 5000,
          'volleyball-net': 10000,
          'scoreboard': 20000,
          'seating': 15000
        },
        courtSizes: {
          basketball: { standard: 420, custom: 0, recreational: 0 },
          badminton: { standard: 81.74, custom: 0, recreational: 0 },
          boxcricket: { standard: 750, custom: 0, recreational: 0 },
          football: { standard: 7140, custom: 0, recreational: 0 },
          tennis: { standard: 260, custom: 0, recreational: 0 },
          volleyball: { standard: 162, custom: 0, recreational: 0 },
          pickleball: { standard: 65, custom: 0, recreational: 0 }
        }
      });

      await defaultPricing.save();
      console.log('Default pricing data created successfully!');
    } else {
      console.log('Pricing data already exists.');
    }

    await mongoose.connection.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error initializing pricing data:', error);
    process.exit(1);
  }
};

initializePricing();