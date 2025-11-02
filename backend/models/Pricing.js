const mongoose = require('mongoose');

const courtSizesSchema = new mongoose.Schema({
  standard: { type: Number, default: 0 },
  custom: { type: Number, default: 0 },
  recreational: { type: Number, default: 0 }
});

const pricingSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true },
  
  // Subbase costs per sq meter
  subbase: {
    concrete: { type: Number, default: 1500 },
    asphalt: { type: Number, default: 1200 }
  },
  
  // Edgewall cost per meter
  edgewall: { type: Number, default: 800 },
  
  // Drainage cost per meter
  drainage: { type: Number, default: 450 },
  
  // Fencing costs per meter
  fencing: {
    chainlink: { type: Number, default: 1200 },
    metal: { type: Number, default: 1800 },
    garnware: { type: Number, default: 2200 },
    aluminium: { type: Number, default: 2800 }
  },
  
  // Flooring costs per sq meter
  flooring: {
    wooden: { type: Number, default: 3500 },
    pvc: { type: Number, default: 2800 },
    acrylic: { type: Number, default: 2200 },
    rubber: { type: Number, default: 3200 }
  },
  
  // Lighting costs
  lighting: {
    standard: { type: Number, default: 5000 },
    neon: { type: Number, default: 8000 },
    antiglare: { type: Number, default: 6500 },
    long: { type: Number, default: 7200 }
  },
  
  // Equipment costs
  equipment: {
    // Basketball
    'basketball-hoop': { type: Number, default: 15000 },
    'basketball-backboard': { type: Number, default: 8000 },
    // Football
    'football-goalpost': { type: Number, default: 25000 },
    // Tennis
    'tennis-net': { type: Number, default: 15000 },
    // Badminton
    'badminton-net': { type: Number, default: 8000 },
    'badminton-posts': { type: Number, default: 12000 },
    // Cricket
    'cricket-stumps': { type: Number, default: 5000 },
    // Volleyball
    'volleyball-net': { type: Number, default: 10000 },
    // Generic
    scoreboard: { type: Number, default: 20000 },
    seating: { type: Number, default: 15000 }
  },
  
  // Court sizes
  courtSizes: {
    basketball: { type: courtSizesSchema, default: { standard: 420, custom: 0, recreational: 0 } },
    badminton: { type: courtSizesSchema, default: { standard: 81.74, custom: 0, recreational: 0 } },
    boxcricket: { type: courtSizesSchema, default: { standard: 750, custom: 0, recreational: 0 } },
    football: { type: courtSizesSchema, default: { standard: 7140, custom: 0, recreational: 0 } },
    tennis: { type: courtSizesSchema, default: { standard: 260, custom: 0, recreational: 0 } },
    volleyball: { type: courtSizesSchema, default: { standard: 162, custom: 0, recreational: 0 } },
    pickleball: { type: courtSizesSchema, default: { standard: 65, custom: 0, recreational: 0 } }
  }
});

module.exports = mongoose.model('Pricing', pricingSchema);