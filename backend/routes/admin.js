const express = require('express');
const Quotation = require('../models/Quotation');
const Pricing = require('../models/Pricing');
const { protect } = require('./auth');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
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
  if (requirements.courtRequirements && requirements.courtRequirements.size > 0) {
    // Multiple courts - calculate for each court
    requirements.courtRequirements.forEach((court, courtKey) => {
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

// PDF Generation Function
const generateQuotationPDF = (quotation) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 15,
        size: 'A4'
      });
      const buffers = [];
      
      // Collect PDF data
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Set page dimensions
      const pageWidth = 595.28; // A4 width in points
      const pageHeight = 841.89; // A4 height in points
      const margin = 15;
      
      let yPosition = margin;

      // Function to check if we need a new page
      const checkNewPage = (spaceNeeded = 10) => {
        if (yPosition + spaceNeeded > pageHeight - 50) {
          doc.addPage();
          yPosition = margin;
          addHeader();
          return true;
        }
        return false;
      };

      // Add Header function
      const addHeader = () => {
        // Red header background
        doc.rect(0, 0, pageWidth, 35).fill('#f44237');
        
        // Company Name and Info
        doc.fillColor('white')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('NEXORA GROUP', margin + 33, 12);
        
        doc.fontSize(8)
           .font('Helvetica')
           .text('Sports Infrastructure Solutions', margin + 33, 22);
        
        // Contact info aligned to right
        doc.fontSize(7)
           .text('+91-8431322728', pageWidth - margin, 10, { align: 'right' })
           .text('info.nexoragroup@gmail.com', pageWidth - margin, 17, { align: 'right' })
           .text('www.nexoragroup.com', pageWidth - margin, 24, { align: 'right' });
        
        doc.fillColor('black');
        yPosition = 45;
      };

      // Initial header
      addHeader();

      // Quotation title
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('QUOTATION FOR SPORTS COURT CONSTRUCTION', pageWidth/2, yPosition, { align: 'center' });
      
      yPosition += 8;
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Ref. No: ${quotation.quotationNumber}`, margin, yPosition)
         .text(`Date: ${new Date(quotation.approvedAt || quotation.createdAt).toLocaleDateString('en-IN')}`, pageWidth - margin, yPosition, { align: 'right' });
      
      yPosition += 4;
      doc.text(`Status: APPROVED`, margin, yPosition);

      // Client Information Section
      checkNewPage(20);
      yPosition += 12;
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('CLIENT DETAILS:', margin, yPosition);
      
      yPosition += 6;
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Name: ${quotation.clientInfo.name}`, margin, yPosition);
      
      yPosition += 4;
      doc.text(`Email: ${quotation.clientInfo.email}`, margin, yPosition);
      
      yPosition += 4;
      doc.text(`Phone: ${quotation.clientInfo.phone}`, margin, yPosition);
      
      yPosition += 4;
      
      // FIXED: Use PDFKit's text wrapping instead of splitTextToSize
      const addressText = `Address: ${quotation.clientInfo.address}`;
      const addressHeight = doc.heightOfString(addressText, {
        width: 180,
        align: 'left'
      });
      
      doc.text(addressText, margin, yPosition, {
        width: 180,
        align: 'left'
      });
      
      yPosition += addressHeight + 8;

      // Project Details
      checkNewPage(15);
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('PROPOSAL DETAILS:', margin, yPosition);
      
      yPosition += 6;
      const sportNames = quotation.projectInfo.sports?.map(s => s.sport.replace(/-/g, ' ').toUpperCase()).join(', ') || 
                        (quotation.projectInfo.sport ? quotation.projectInfo.sport.replace(/-/g, ' ').toUpperCase() : 'SPORTS COURT');
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Proposal for ${sportNames} ${quotation.projectInfo.constructionType?.toUpperCase() || 'STANDARD'}`, margin, yPosition);
      
      yPosition += 4;
      doc.text(`Area: ${quotation.projectInfo.area || 0} sq. meters`, margin, yPosition);
      
      yPosition += 4;
      doc.text(`Perimeter: ${quotation.projectInfo.perimeter || 0} meters`, margin, yPosition);
      
      yPosition += 10;

      // Price Breakdown Table
      checkNewPage(50);
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('PRICE BREAKDOWN', margin, yPosition);
      
      yPosition += 8;
      
      // Table Headers
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('Description', margin, yPosition)
         .text('Amount (₹)', pageWidth - margin, yPosition, { align: 'right' });
      
      yPosition += 5;
      doc.moveTo(margin, yPosition).lineTo(pageWidth - margin, yPosition).strokeColor('#333').stroke();
      
      yPosition += 8;
      const pricing = quotation.pricing || {};

      // Price Rows function
      const addPriceRow = (description, amount) => {
        checkNewPage(10);
        if (amount > 0) {
          doc.fontSize(9)
             .font('Helvetica')
             .text(description, margin, yPosition)
             .text(amount.toLocaleString('en-IN'), pageWidth - margin, yPosition, { align: 'right' });
          yPosition += 12;
        }
      };

      // Add pricing rows
      addPriceRow('Subbase Construction', pricing.subbaseCost || 0);
      addPriceRow('Flooring System', pricing.flooringCost || 0);
      addPriceRow('Sports Equipment', pricing.equipmentCost || 0);
      addPriceRow('Fencing System', pricing.fencingCost || 0);
      addPriceRow('Lighting System', pricing.lightingCost || 0);
      addPriceRow('Drainage System', pricing.drainageCost || 0);
      addPriceRow('Edgewall Construction', pricing.edgewallCost || 0);

      // Total Section
      checkNewPage(30);
      yPosition += 5;
      doc.moveTo(margin, yPosition).lineTo(pageWidth - margin, yPosition).strokeColor('#333').stroke();
      
      yPosition += 10;
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('Subtotal:', pageWidth - 120, yPosition)
         .text((pricing.subtotal || 0).toLocaleString('en-IN'), pageWidth - margin, yPosition, { align: 'right' });
      
      yPosition += 10;
      doc.text('GST @18%:', pageWidth - 120, yPosition)
         .text((pricing.gstAmount || 0).toLocaleString('en-IN'), pageWidth - margin, yPosition, { align: 'right' });
      
      yPosition += 12;
      doc.moveTo(pageWidth - 150, yPosition - 2).lineTo(pageWidth - margin, yPosition - 2).strokeColor('#f44237').lineWidth(2).stroke();
      
      yPosition += 5;
      doc.fontSize(11)
         .text('GRAND TOTAL:', pageWidth - 120, yPosition)
         .text((pricing.grandTotal || 0).toLocaleString('en-IN'), pageWidth - margin, yPosition, { align: 'right' });

      // Admin Notes
      if (quotation.adminNotes) {
        checkNewPage(40);
        yPosition += 20;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('SPECIAL NOTES:', margin, yPosition);
        
        yPosition += 8;
        
        // FIXED: Use PDFKit's text wrapping for admin notes
        const notesHeight = doc.heightOfString(quotation.adminNotes, {
          width: pageWidth - (2 * margin)
        });
        
        doc.fontSize(9)
           .font('Helvetica')
           .text(quotation.adminNotes, margin, yPosition, {
             width: pageWidth - (2 * margin),
             align: 'left'
           });
        
        yPosition += notesHeight + 8;
      }

      // Terms and Conditions
      checkNewPage(60);
      yPosition += 20;
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('TERMS & CONDITIONS:', margin, yPosition);
      
      yPosition += 8;
      const terms = [
        '• This quotation is valid for 30 days from the date of issue',
        '• Prices are subject to change without prior notice',
        '• 50% advance payment required to commence work',
        '• Balance payment upon completion of project',
        '• Installation timeline: 4-6 weeks from advance payment',
        '• Warranty: 1 year on materials and workmanship'
      ];
      
      terms.forEach(term => {
        checkNewPage(10);
        doc.fontSize(8)
           .font('Helvetica')
           .text(term, margin + 5, yPosition);
        yPosition += 10;
      });

      // Footer function for all pages
      const addFooter = () => {
        const footerY = pageHeight - 20;
        
        // Red footer background
        doc.rect(0, footerY, pageWidth, 20).fill('#f44237');
        
        // Footer text
        doc.fillColor('white')
           .fontSize(7)
           .font('Helvetica')
           .text('NEXORA GROUP - Sports Infrastructure Solutions | Jalahalli West, Bangalore-560015', 
                 pageWidth/2, footerY + 6, { align: 'center' })
           .text('+91 8431322728 | info.nexoragroup@gmail.com | www.nexoragroup.com', 
                 pageWidth/2, footerY + 13, { align: 'center' });
      };

      // Add footer to current page
      addFooter();

      // Page number (simple version since PDFKit doesn't have easy multi-page footer)
      doc.fillColor(100, 100, 100)
         .fontSize(8)
         .text('Page 1 of 1', pageWidth/2, pageHeight - 30, { align: 'center' });

      doc.end();

    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      reject(error);
    }
  });
};

// Email sending function with PDF attachment
const sendQuotationEmailWithPDF = async (quotation) => {
  try {
    console.log('📧 Generating PDF for quotation...');
    
    // Generate PDF
    const pdfBuffer = await generateQuotationPDF(quotation);
    
    console.log('📧 PDF generated successfully, preparing email...');

    // Define sportNames properly for email
    const sportNames = quotation.projectInfo.sports?.map(s => s.sport.replace(/-/g, ' ').toUpperCase()).join(', ') || 
                      (quotation.projectInfo.sport ? quotation.projectInfo.sport.replace(/-/g, ' ').toUpperCase() : 'SPORTS COURT');

    const mailOptions = {
      from: `"Nexora Group" <${process.env.EMAIL_USER || 'info.nexoragroup@gmail.com'}>`,
      to: quotation.clientInfo.email,
      subject: `Your Approved Quotation #${quotation.quotationNumber} - Nexora Group`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    max-width: 600px; 
                    margin: 0 auto; 
                    padding: 20px;
                }
                .header { 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 30px; 
                    text-align: center; 
                    border-radius: 10px 10px 0 0;
                }
                .content { 
                    padding: 30px; 
                    background: #f8f9fa;
                    border-radius: 0 0 10px 10px;
                }
                .quotation-details { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                    border-left: 4px solid #3498db;
                }
                .price-highlight { 
                    font-size: 20px; 
                    font-weight: bold; 
                    color: #2c3e50; 
                    background: #e8f4fd;
                    padding: 15px;
                    border-radius: 5px;
                    text-align: center;
                }
                .button { 
                    background: #27ae60; 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block; 
                    font-weight: bold;
                    margin: 10px 5px;
                }
                .footer { 
                    background: #2c3e50; 
                    color: white; 
                    padding: 20px; 
                    text-align: center; 
                    font-size: 12px; 
                    border-radius: 5px;
                    margin-top: 20px;
                }
                .attachment-note {
                    background: #fff3cd;
                    padding: 15px;
                    border-radius: 5px;
                    border-left: 4px solid #ffc107;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 style="margin: 0; font-size: 28px;">NEXORA GROUP</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Sports Infrastructure Solutions</p>
            </div>
            
            <div class="content">
                <h2 style="color: #27ae60; text-align: center;">🎉 Your Quotation Has Been Approved!</h2>
                
                <p>Dear <strong>${quotation.clientInfo.name}</strong>,</p>
                
                <p>We're pleased to inform you that your sports ground construction quotation has been reviewed and approved by our team.</p>
                
                <div class="attachment-note">
                    <h3 style="margin-top: 0;">📎 Download Your Quotation</h3>
                    <p>We've attached a detailed PDF quotation for your reference. You can download and save it for your records.</p>
                </div>

                <div class="quotation-details">
                    <h3 style="margin-top: 0; color: #2c3e50;">Quotation Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Quotation Number:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${quotation.quotationNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Project:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${sportNames} Construction</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Construction Type:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${quotation.projectInfo.constructionType || 'Standard'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;"><strong>Area:</strong></td>
                            <td style="padding: 8px 0;">${quotation.projectInfo.area || 0} sq. meters</td>
                        </tr>
                    </table>
                </div>

                <div class="price-highlight">
                    Grand Total: ₹${quotation.pricing?.grandTotal?.toLocaleString('en-IN') || '0'}
                </div>

                ${quotation.adminNotes ? `
                <div class="quotation-details">
                    <h3 style="margin-top: 0; color: #2c3e50;">Special Notes from Our Team</h3>
                    <p style="font-style: italic; background: #f8f9fa; padding: 15px; border-radius: 5px;">${quotation.adminNotes}</p>
                </div>
                ` : ''}

                <h3>📞 What's Next?</h3>
                <ul>
                    <li>Our project manager will contact you within 24 hours</li>
                    <li>We'll schedule a site visit if required</li>
                    <li>Project timeline discussion and finalization</li>
                    <li>Payment schedule and contract signing</li>
                </ul>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="tel:+918431322728" class="button">📞 Call Us Now</a>
                    <a href="mailto:info.nexoragroup@gmail.com" class="button" style="background: #3498db;">📧 Email Us</a>
                </div>
            </div>
            
            <div class="footer">
                <p style="margin: 0;"><strong>NEXORA GROUP</strong></p>
                <p style="margin: 5px 0; opacity: 0.8;">Jalahalli West, Bangalore 560015</p>
                <p style="margin: 5px 0; opacity: 0.8;">+91 8431322728 | info.nexoragroup@gmail.com | www.nexoragroup.com</p>
                <p style="margin: 10px 0 0 0; opacity: 0.6; font-size: 11px;">This is an automated email. Please do not reply to this message.</p>
            </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `Nexora_Quotation_${quotation.quotationNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    console.log('📧 Sending email with PDF attachment...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email with PDF sent successfully to ${quotation.clientInfo.email}`);
    
    return { 
      success: true, 
      messageId: info.messageId,
      pdfGenerated: true
    };
  } catch (error) {
    console.error('❌ Error sending email with PDF:', error);
    return { 
      success: false, 
      error: error.message,
      pdfGenerated: false
    };
  }
};

// Protect all routes
router.use(protect);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const quotationsToday = await Quotation.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    
    const totalQuotations = await Quotation.countDocuments();
    const pendingQuotations = await Quotation.countDocuments({ status: 'pending' });
    const approvedQuotations = await Quotation.countDocuments({ status: 'approved' });
    
    res.json({
      quotationsToday,
      totalQuotations,
      pendingQuotations,
      approvedQuotations
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all quotations with pagination
router.get('/quotations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const statusFilter = req.query.status;
    let query = {};
    
    if (statusFilter && statusFilter !== 'all') {
      query.status = statusFilter;
    }
    
    const quotations = await Quotation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Quotation.countDocuments(query);
    
    res.json({
      quotations,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalQuotations: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single quotation
router.get('/quotations/:id', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    res.json(quotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update quotation
router.put('/quotations/:id', async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    res.json(quotation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Edit quotation with full update capability
router.put('/quotations/:id/edit', async (req, res) => {
  try {
    const { clientInfo, projectInfo, requirements, pricing } = req.body;
    
    console.log('📝 Editing quotation:', req.params.id);
    console.log('📦 Received data:', { clientInfo, projectInfo, requirements, pricing });

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Update all fields with proper validation
    if (clientInfo) {
      quotation.clientInfo = { 
        ...quotation.clientInfo,
        ...clientInfo 
      };
    }
    
    if (projectInfo) {
      quotation.projectInfo = { 
        ...quotation.projectInfo,
        ...projectInfo 
      };
    }
    
    if (requirements) {
      quotation.requirements = { 
        ...quotation.requirements,
        ...requirements 
      };
    }
    
    if (pricing) {
      // Ensure all pricing fields are numbers
      const sanitizedPricing = {};
      Object.keys(pricing).forEach(key => {
        sanitizedPricing[key] = Number(pricing[key]) || 0;
      });
      quotation.pricing = { 
        ...quotation.pricing,
        ...sanitizedPricing 
      };
    }

    // Recalculate totals if pricing was modified
    if (pricing) {
      const costFields = ['subbaseCost', 'edgewallCost', 'drainageCost', 'fencingCost', 'flooringCost', 'equipmentCost', 'lightingCost'];
      quotation.pricing.subtotal = costFields.reduce((sum, field) => {
        return sum + (Number(quotation.pricing[field]) || 0);
      }, 0);
      
      quotation.pricing.gstAmount = quotation.pricing.subtotal * 0.18;
      quotation.pricing.grandTotal = quotation.pricing.subtotal + quotation.pricing.gstAmount;
    }

    quotation.updatedAt = new Date();
    
    console.log('💾 Saving updated quotation...');
    await quotation.save();

    console.log('✅ Quotation updated successfully');
    res.json({ 
      message: 'Quotation updated successfully', 
      quotation 
    });
    
  } catch (error) {
    console.error('❌ Error updating quotation:', error);
    res.status(400).json({ 
      message: 'Error updating quotation: ' + error.message 
    });
  }
});

// Approve quotation with PDF email
router.post('/quotations/:id/approve', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Update status
    quotation.status = 'approved';
    quotation.adminNotes = req.body.notes || '';
    quotation.approvedAt = new Date();
    quotation.approvedBy = req.user.username;
    
    await quotation.save();
    
    // Send email with PDF attachment
    const emailResult = await sendQuotationEmailWithPDF(quotation);
    
    if (emailResult.success) {
      res.json({ 
        message: 'Quotation approved and PDF sent to client via email!', 
        quotation,
        emailSent: true,
        pdfAttached: true,
        recipient: quotation.clientInfo.email
      });
    } else {
      res.json({ 
        message: 'Quotation approved but email with PDF failed to send. Please contact the client manually.', 
        quotation,
        emailSent: false,
        pdfAttached: false,
        emailError: emailResult.error,
        recipient: quotation.clientInfo.email
      });
    }
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reject quotation
router.post('/quotations/:id/reject', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    quotation.status = 'rejected';
    quotation.adminNotes = req.body.notes || 'Quotation rejected after review.';
    quotation.rejectedAt = new Date();
    quotation.rejectedBy = req.user.username;
    
    await quotation.save();
    
    res.json({ 
      message: 'Quotation rejected successfully', 
      quotation 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;