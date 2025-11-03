const express = require('express');
const Quotation = require('../models/Quotation');
const Pricing = require('../models/Pricing');
const router = express.Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Quotations route is working!' });
});

// Create new quotation with proper pricing calculation
router.post('/', async (req, res) => {
  try {
    console.log('📦 Received quotation request');
    
    const { clientInfo, projectInfo, requirements } = req.body;

    // Basic validation
    if (!clientInfo || !clientInfo.name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client name is required' 
      });
    }

    // Get pricing data
    const pricingData = await Pricing.findOne({ category: 'default' });
    if (!pricingData) {
      return res.status(500).json({
        success: false,
        message: 'Pricing data not found'
      });
    }

    // Calculate pricing based on requirements
    const calculatedPricing = await calculateQuotationPricing(projectInfo, requirements, pricingData);

    // Create new quotation
    const quotation = new Quotation({
      clientInfo,
      projectInfo: projectInfo || {},
      requirements: requirements || {},
      pricing: calculatedPricing
    });

    // Save to database
    await quotation.save();
    
    console.log('✅ Quotation created successfully:', quotation.quotationNumber);

    res.status(201).json({
      success: true,
      message: 'Quotation generated successfully',
      quotation: quotation
    });

  } catch (error) {
    console.error('❌ Error creating quotation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating quotation: ' + error.message 
    });
  }
});

// Pricing calculation function
const calculateQuotationPricing = async (projectInfo, requirements, pricingData) => {
  let totalCost = {
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

  const safeMultiply = (a, b) => (Number(a) || 0) * (Number(b) || 0);
  const projectArea = Number(projectInfo.area) || 0;
  const projectPerimeter = Number(projectInfo.perimeter) || 0;

  // Check if we have multiple courts or single court requirements
  if (requirements.courtRequirements && Object.keys(requirements.courtRequirements).length > 0) {
    // Multiple courts - calculate for each court
    Object.values(requirements.courtRequirements).forEach(court => {
      const area = Number(court.area) || projectArea;
      const perimeter = Number(court.perimeter) || projectPerimeter;

      // Subbase cost
      if (court.subbase && court.subbase.type && pricingData.subbase[court.subbase.type]) {
        totalCost.subbaseCost += safeMultiply(area, pricingData.subbase[court.subbase.type]);
      }
      
      // Edgewall cost
      if (court.subbase && court.subbase.edgewall) {
        totalCost.edgewallCost += safeMultiply(perimeter, pricingData.edgewall);
      }
      
      // Drainage cost
      if (court.subbase && court.subbase.drainage && court.subbase.drainage.required) {
        const drainageLength = Math.ceil(perimeter / 4.5);
        totalCost.drainageCost += safeMultiply(drainageLength, pricingData.drainage);
      }
      
      // Fencing cost
      if (court.fencing && court.fencing.required && court.fencing.type && pricingData.fencing[court.fencing.type]) {
        totalCost.fencingCost += safeMultiply(perimeter, pricingData.fencing[court.fencing.type]);
      }
      
      // Flooring cost
      if (court.flooring && court.flooring.type && pricingData.flooring[court.flooring.type]) {
        totalCost.flooringCost += safeMultiply(area, pricingData.flooring[court.flooring.type]);
      }
      
      // Equipment cost
      if (court.equipment && Array.isArray(court.equipment)) {
        court.equipment.forEach(item => {
          if (item.totalCost) {
            totalCost.equipmentCost += Number(item.totalCost) || 0;
          } else if (item.unitCost && item.quantity) {
            totalCost.equipmentCost += (Number(item.unitCost) || 0) * (Number(item.quantity) || 1);
          }
        });
      }
      
      // Lighting cost
      if (court.lighting && court.lighting.required) {
        const poleSpacing = 9.14;
        const poles = Math.ceil(perimeter / poleSpacing);
        const lightsPerPole = Number(court.lighting.lightsPerPole) || 2;
        const lightCostPerUnit = pricingData.lighting[court.lighting.type] || pricingData.lighting.standard;
        
        totalCost.lightingCost += poles * lightsPerPole * lightCostPerUnit;
      }
    });
  } else {
    // Single court - use original calculation (backward compatibility)
    
    // Subbase cost
    if (requirements.subbase && requirements.subbase.type && pricingData.subbase[requirements.subbase.type]) {
      totalCost.subbaseCost = safeMultiply(projectArea, pricingData.subbase[requirements.subbase.type]);
    }
    
    // Edgewall cost
    if (requirements.subbase && requirements.subbase.edgewall) {
      totalCost.edgewallCost = safeMultiply(projectPerimeter, pricingData.edgewall);
    }
    
    // Drainage cost
    if (requirements.subbase && requirements.subbase.drainage && requirements.subbase.drainage.required) {
      const drainageLength = Math.ceil(projectPerimeter / 4.5);
      totalCost.drainageCost = safeMultiply(drainageLength, pricingData.drainage);
    }
    
    // Fencing cost
    if (requirements.fencing && requirements.fencing.required && requirements.fencing.type && pricingData.fencing[requirements.fencing.type]) {
      totalCost.fencingCost = safeMultiply(projectPerimeter, pricingData.fencing[requirements.fencing.type]);
    }
    
    // Flooring cost
    if (requirements.flooring && requirements.flooring.type && pricingData.flooring[requirements.flooring.type]) {
      totalCost.flooringCost = safeMultiply(projectArea, pricingData.flooring[requirements.flooring.type]);
    }
    
    // Equipment cost
    if (requirements.equipment && Array.isArray(requirements.equipment)) {
      requirements.equipment.forEach(item => {
        if (item.totalCost) {
          totalCost.equipmentCost += Number(item.totalCost) || 0;
        } else if (item.unitCost && item.quantity) {
          totalCost.equipmentCost += (Number(item.unitCost) || 0) * (Number(item.quantity) || 1);
        }
      });
    }
    
    // Lighting cost
    if (requirements.lighting && requirements.lighting.required) {
      const poleSpacing = 9.14;
      const poles = Math.ceil(projectPerimeter / poleSpacing);
      const lightsPerPole = Number(requirements.lighting.lightsPerPole) || 2;
      const lightCostPerUnit = pricingData.lighting[requirements.lighting.type] || pricingData.lighting.standard;
      
      totalCost.lightingCost = poles * lightsPerPole * lightCostPerUnit;
    }
  }

  // Calculate totals
  const costFields = ['subbaseCost', 'edgewallCost', 'drainageCost', 'fencingCost', 'flooringCost', 'equipmentCost', 'lightingCost'];
  totalCost.subtotal = costFields.reduce((sum, field) => {
    return sum + (Number(totalCost[field]) || 0);
  }, 0);
  
  totalCost.gstAmount = totalCost.subtotal * 0.18;
  totalCost.grandTotal = totalCost.subtotal + totalCost.gstAmount;

  // Ensure all values are numbers
  Object.keys(totalCost).forEach(key => {
    totalCost[key] = Math.round(Number(totalCost[key]) || 0);
  });

  return totalCost;
};

// Get all quotations
router.get('/', async (req, res) => {
  try {
    const quotations = await Quotation.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      quotations: quotations
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching quotations' 
    });
  }
});

module.exports = router;