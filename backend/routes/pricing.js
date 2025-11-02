const express = require('express');
const router = express.Router();

// Simple pricing endpoint
router.get('/', (req, res) => {
  const pricing = {
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
    }
  };
  
  res.json(pricing);
});

module.exports = router;