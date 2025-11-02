const express = require('express');
const Quotation = require('../models/Quotation');
const router = express.Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Quotations route is working!' });
});

// Create new quotation - SIMPLIFIED VERSION
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

    // Create simple pricing (we'll calculate properly later)
    const simplePricing = {
      subbaseCost: 10000,
      edgewallCost: 5000,
      drainageCost: 3000,
      fencingCost: 15000,
      flooringCost: 20000,
      equipmentCost: 25000,
      lightingCost: 12000,
      subtotal: 90000,
      gstAmount: 16200,
      grandTotal: 106200
    };

    // Create new quotation
    const quotation = new Quotation({
      clientInfo,
      projectInfo: projectInfo || {},
      requirements: requirements || {},
      pricing: simplePricing
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