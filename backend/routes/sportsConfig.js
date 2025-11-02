const express = require('express');
const router = express.Router();

// Sports configuration data
const sportsConfig = [
  { 
    id: 'basketball', 
    name: 'Basketball', 
    image: '🏀',
    category: 'outdoor',
    description: 'Professional basketball court'
  },
  { 
    id: 'badminton', 
    name: 'Badminton', 
    image: '🏸',
    category: 'indoor',
    description: 'Standard badminton court'
  },
  { 
    id: 'boxcricket', 
    name: 'Box Cricket', 
    image: '🏏',
    category: 'outdoor',
    description: 'Indoor cricket facility'
  },
  { 
    id: 'football', 
    name: 'Football', 
    image: '⚽',
    category: 'outdoor',
    description: 'Professional football field'
  },
  { 
    id: 'tennis', 
    name: 'Tennis', 
    image: '🎾',
    category: 'outdoor',
    description: 'Standard tennis court'
  },
  { 
    id: 'volleyball', 
    name: 'Volleyball', 
    image: '🏐',
    category: 'outdoor',
    description: 'Beach and indoor volleyball'
  },
  { 
    id: 'pickleball', 
    name: 'Pickleball', 
    image: '🥒',
    category: 'outdoor',
    description: 'Modern paddle sport'
  }
];

// Get all sports configuration
router.get('/', (req, res) => {
  try {
    console.log('📡 Sports config requested');
    res.json({
      success: true,
      sports: sportsConfig,
      outdoor: sportsConfig.filter(sport => sport.category === 'outdoor'),
      indoor: sportsConfig.filter(sport => sport.category === 'indoor')
    });
  } catch (error) {
    console.error('Error fetching sports config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching sports configuration' 
    });
  }
});

// Get equipment for specific sport
router.get('/equipment/:sport', (req, res) => {
  try {
    const { sport } = req.params;
    console.log(`📡 Equipment requested for: ${sport}`);
    
    const equipmentData = {
      basketball: [
        { name: 'basketball-hoop', quantity: 2, unitCost: 15000 },
        { name: 'basketball-backboard', quantity: 2, unitCost: 8000 }
      ],
      badminton: [
        { name: 'badminton-net', quantity: 1, unitCost: 8000 },
        { name: 'badminton-posts', quantity: 2, unitCost: 12000 }
      ],
      boxcricket: [
        { name: 'cricket-stumps', quantity: 3, unitCost: 5000 }
      ],
      football: [
        { name: 'football-goalpost', quantity: 2, unitCost: 25000 }
      ],
      tennis: [
        { name: 'tennis-net', quantity: 1, unitCost: 15000 }
      ],
      volleyball: [
        { name: 'volleyball-net', quantity: 1, unitCost: 10000 }
      ],
      pickleball: [
        { name: 'volleyball-net', quantity: 1, unitCost: 8000 } // Reusing volleyball net
      ]
    };

    const equipment = equipmentData[sport] || [];
    res.json(equipment);
    
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching equipment data' 
    });
  }
});

module.exports = router;