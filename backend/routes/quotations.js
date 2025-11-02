const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quotation');
const Pricing = require('../models/Pricing');

// Get sports configuration
router.get('/sports-config', (req, res) => {
  const sportsConfig = {
    sports: [
      { id: 'basketball', name: 'Basketball Court', image: '🏀', fencing: 'chainlink' },
      { id: 'badminton', name: 'Badminton Court', image: '🏸', fencing: 'aluminium' },
      { id: 'boxcricket', name: 'Box Cricket', image: '🏏', fencing: 'garnware' },
      { id: 'football', name: 'Football Field', image: '⚽', fencing: 'garnware' },
      { id: 'tennis', name: 'Tennis Court', image: '🎾', fencing: 'chainlink' },
      { id: 'volleyball', name: 'Volleyball Court', image: '🏐', fencing: 'chainlink' },
      { id: 'pickleball', name: 'Pickleball Court', image: '🎾', fencing: 'chainlink' }
    ]
  };
  res.json(sportsConfig);
});

// Get equipment for specific sport
router.get('/equipment/:sport', async (req, res) => {
  try {
    const pricing = await Pricing.findOne({ category: 'default' });
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing data not found' });
    }

    const sport = req.params.sport;
    
    const equipmentMap = {
      'basketball': [
        { id: 'basketball-hoop', name: 'Basketball Hoop System', quantity: 2 },
        { id: 'basketball-backboard', name: 'Backboard', quantity: 2 }
      ],
      'badminton': [
        { id: 'badminton-posts', name: 'Badminton Posts', quantity: 2 },
        { id: 'badminton-net', name: 'Badminton Net', quantity: 1 }
      ],
      'boxcricket': [
        { id: 'cricket-stumps', name: 'Cricket Stumps', quantity: 3 }
      ],
      'football': [
        { id: 'football-goalpost', name: 'Football Goalpost', quantity: 2 }
      ],
      'tennis': [
        { id: 'tennis-net', name: 'Tennis Net', quantity: 1 }
      ],
      'volleyball': [
        { id: 'volleyball-net', name: 'Volleyball Net', quantity: 1 }
      ],
      'pickleball': [
        { id: 'volleyball-net', name: 'Pickleball Net', quantity: 1 }
      ]
    };

    const equipment = equipmentMap[sport] || [];
    const equipmentWithPricing = equipment.map(item => ({
      ...item,
      unitCost: pricing.equipment[item.id] || 0,
      totalCost: ((pricing.equipment[item.id] || 0) * (item.quantity || 1))
    }));

    res.json(equipmentWithPricing);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new quotation
router.post('/', async (req, res) => {
  try {
    const { clientInfo, projectInfo, requirements } = req.body;
    
    // Validate required fields
    if (!clientInfo || !clientInfo.name || !clientInfo.email || !clientInfo.phone) {
      return res.status(400).json({ message: 'Please complete all client information' });
    }
    
    if (!projectInfo || !projectInfo.constructionType) {
      return res.status(400).json({ message: 'Please provide project information' });
    }
    
    // Create quotation
    const quotation = new Quotation({
      clientInfo,
      projectInfo,
      requirements
    });
    
    // Calculate pricing
    await calculatePricing(quotation);
    
    await quotation.save();
    
    res.status(201).json({
      message: 'Thank you for your interest! Within 24 hours, we will send the quotation to your email.',
      quotationNumber: quotation.quotationNumber,
      quotation
    });
    
  } catch (error) {
    console.error('Error creating quotation:', error);
    res.status(400).json({ message: error.message });
  }
});

// Pricing calculation function
const calculatePricing = async (quotation) => {
  const pricing = await Pricing.findOne({ category: 'default' });
  if (!pricing) throw new Error('Pricing data not found');
  
  const { projectInfo, requirements } = quotation;
  
  // Reset pricing with safe defaults
  quotation.pricing = {
    subbaseCost: 0,
    edgewallCost: 0,
    drainageCost: 0,
    fencingCost: 0,
    flooringCost: 0,
    equipmentCost: 0,
    lightingCost: 0,
    subtotal: 0,
    gstAmount: 0,
    grandTotal: 0
  };
  
  // Safe calculation functions
  const safeMultiply = (a, b) => (Number(a) || 0) * (Number(b) || 0);
  
  // Check if we have multiple courts or single court requirements
  if (requirements.courtRequirements) {
    // Multiple courts - calculate for each court
    Object.values(requirements.courtRequirements).forEach(court => {
      // Use court-specific area/perimeter or fallback to project info
      const area = Number(court.area) || Number(projectInfo.area) || 0;
      const perimeter = Number(court.perimeter) || Number(projectInfo.perimeter) || 0;
      
      // Subbase cost
      if (court.subbase && court.subbase.type && pricing.subbase[court.subbase.type]) {
        quotation.pricing.subbaseCost += safeMultiply(area, pricing.subbase[court.subbase.type]);
      }
      
      // Edgewall cost
      if (court.subbase && court.subbase.edgewall) {
        quotation.pricing.edgewallCost += safeMultiply(perimeter, pricing.edgewall);
      }
      
      // Drainage cost
      if (court.subbase && court.subbase.drainage && court.subbase.drainage.required) {
        const drainageLength = Math.ceil(perimeter / 4.5);
        quotation.pricing.drainageCost += safeMultiply(drainageLength, pricing.drainage);
      }
      
      // Fencing cost
      if (court.fencing && court.fencing.required && court.fencing.type) {
        quotation.pricing.fencingCost += safeMultiply(perimeter, pricing.fencing[court.fencing.type]);
      }
      
      // Flooring cost
      if (court.flooring && court.flooring.type && pricing.flooring[court.flooring.type]) {
        quotation.pricing.flooringCost += safeMultiply(area, pricing.flooring[court.flooring.type]);
      }
      
      // Equipment cost
      if (court.equipment && Array.isArray(court.equipment)) {
        quotation.pricing.equipmentCost += court.equipment.reduce((total, item) => {
          return total + (Number(item.totalCost) || 0);
        }, 0);
      }
      
      // Lighting cost
      if (court.lighting && court.lighting.required) {
        const poleSpacing = 9.14;
        const poles = Math.ceil(perimeter / poleSpacing);
        const lightsPerPole = Number(court.lighting.lightsPerPole) || 2;
        const lightCostPerUnit = pricing.lighting[court.lighting.type] || pricing.lighting.standard;
        
        quotation.pricing.lightingCost += poles * lightsPerPole * lightCostPerUnit;
        court.lighting.poles = poles;
      }
    });
  } else {
    // Single court - use original calculation (backward compatibility)
    const area = Number(projectInfo.area) || 0;
    const perimeter = Number(projectInfo.perimeter) || 0;
    
    // Subbase cost
    if (requirements.subbase && requirements.subbase.type && pricing.subbase[requirements.subbase.type]) {
      quotation.pricing.subbaseCost = safeMultiply(area, pricing.subbase[requirements.subbase.type]);
    }
    
    // Edgewall cost
    if (requirements.subbase && requirements.subbase.edgewall) {
      quotation.pricing.edgewallCost = safeMultiply(perimeter, pricing.edgewall);
    }
    
    // Drainage cost
    if (requirements.subbase && requirements.subbase.drainage && requirements.subbase.drainage.required) {
      const drainageLength = Math.ceil(perimeter / 4.5);
      quotation.pricing.drainageCost = safeMultiply(drainageLength, pricing.drainage);
    }
    
    // Fencing cost
    if (requirements.fencing && requirements.fencing.required && requirements.fencing.type) {
      quotation.pricing.fencingCost = safeMultiply(perimeter, pricing.fencing[requirements.fencing.type]);
    }
    
    // Flooring cost
    if (requirements.flooring && requirements.flooring.type && pricing.flooring[requirements.flooring.type]) {
      quotation.pricing.flooringCost = safeMultiply(area, pricing.flooring[requirements.flooring.type]);
    }
    
    // Equipment cost
    if (requirements.equipment && Array.isArray(requirements.equipment)) {
      quotation.pricing.equipmentCost = requirements.equipment.reduce((total, item) => {
        return total + (Number(item.totalCost) || 0);
      }, 0);
    }
    
    // Lighting cost
    if (requirements.lighting && requirements.lighting.required) {
      const poleSpacing = 9.14;
      const poles = Math.ceil(perimeter / poleSpacing);
      const lightsPerPole = Number(requirements.lighting.lightsPerPole) || 2;
      const lightCostPerUnit = pricing.lighting[requirements.lighting.type] || pricing.lighting.standard;
      
      quotation.pricing.lightingCost = poles * lightsPerPole * lightCostPerUnit;
      requirements.lighting.poles = poles;
    }
  }
  
  // Calculate totals safely
  const costFields = ['subbaseCost', 'edgewallCost', 'drainageCost', 'fencingCost', 'flooringCost', 'equipmentCost', 'lightingCost'];
  quotation.pricing.subtotal = costFields.reduce((sum, field) => {
    const value = Number(quotation.pricing[field]) || 0;
    return sum + value;
  }, 0);
  
  quotation.pricing.gstAmount = quotation.pricing.subtotal * 0.18;
  quotation.pricing.grandTotal = quotation.pricing.subtotal + quotation.pricing.gstAmount;
  
  // Ensure all values are numbers
  Object.keys(quotation.pricing).forEach(key => {
    quotation.pricing[key] = Number(quotation.pricing[key]) || 0;
  });
};

module.exports = router;