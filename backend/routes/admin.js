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

// NEW: Safe pricing calculation that doesn't modify original data
const calculatePricingSafely = async (quotation) => {
  try {
    const pricing = await Pricing.findOne({ category: 'default' });
    if (!pricing) {
      console.error('❌ Pricing data not found');
      return null;
    }

    // Create a deep copy of the quotation to avoid modifying the original
    const quotationCopy = JSON.parse(JSON.stringify(quotation));
    
    const projectInfo = quotationCopy.projectInfo || {};
    const requirements = quotationCopy.requirements || {};
    
    // Initialize new pricing object
    const newPricing = {
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

    console.log('📊 Calculating pricing for:', {
      area: projectArea,
      perimeter: projectPerimeter,
      hasCourtRequirements: !!requirements.courtRequirements,
      courtCount: requirements.courtRequirements ? Object.keys(requirements.courtRequirements).length : 0
    });

    const courtRequirements = requirements.courtRequirements || {};
    const hasMultipleCourts = Object.keys(courtRequirements).length > 0;

    if (hasMultipleCourts) {
      console.log('🏟️ Multiple courts detected, calculating for each court...');
      
      Object.values(courtRequirements).forEach((court, index) => {
        if (!court) {
          console.log(`⚠️ Court ${index} is null, skipping`);
          return;
        }
        
        const courtArea = Number(court.area) || projectArea;
        const courtPerimeter = Number(court.perimeter) || projectPerimeter;

        const courtSubbase = court.subbase || {};
        const courtFencing = court.fencing || {};
        const courtFlooring = court.flooring || {};
        const courtLighting = court.lighting || {};
        const courtEquipment = court.equipment || [];

        console.log(`📐 Court ${index + 1}: Area=${courtArea}, Perimeter=${courtPerimeter}`);

        // Subbase cost
        if (courtSubbase.type && pricing.subbase[courtSubbase.type]) {
          const cost = safeMultiply(courtArea, pricing.subbase[courtSubbase.type]);
          newPricing.subbaseCost += cost;
          console.log(`🏗️ Subbase (${courtSubbase.type}): ${courtArea} m² × ₹${pricing.subbase[courtSubbase.type]} = ₹${cost}`);
        }
        
        // Edgewall cost
        if (courtSubbase.edgewall) {
          const cost = safeMultiply(courtPerimeter, pricing.edgewall);
          newPricing.edgewallCost += cost;
          console.log(`🧱 Edgewall: ${courtPerimeter} m × ₹${pricing.edgewall} = ₹${cost}`);
        }
        
        // Drainage cost
        const courtDrainage = courtSubbase.drainage || {};
        if (courtDrainage.required) {
          const drainageLength = Math.ceil(courtPerimeter / 4.5);
          const cost = safeMultiply(drainageLength, pricing.drainage);
          newPricing.drainageCost += cost;
          console.log(`💧 Drainage: ${drainageLength} m × ₹${pricing.drainage} = ₹${cost}`);
        }
        
        // Fencing cost
        if (courtFencing.required && courtFencing.type && pricing.fencing[courtFencing.type]) {
          const cost = safeMultiply(courtPerimeter, pricing.fencing[courtFencing.type]);
          newPricing.fencingCost += cost;
          console.log(`🔗 Fencing (${courtFencing.type}): ${courtPerimeter} m × ₹${pricing.fencing[courtFencing.type]} = ₹${cost}`);
        }
        
        // Flooring cost
        if (courtFlooring.type && pricing.flooring[courtFlooring.type]) {
          const cost = safeMultiply(courtArea, pricing.flooring[courtFlooring.type]);
          newPricing.flooringCost += cost;
          console.log(`🏓 Flooring (${courtFlooring.type}): ${courtArea} m² × ₹${pricing.flooring[courtFlooring.type]} = ₹${cost}`);
        }
        
        // Equipment cost
        if (Array.isArray(courtEquipment)) {
          const equipmentCost = courtEquipment.reduce((total, item) => {
            return total + (Number(item.totalCost) || 0);
          }, 0);
          newPricing.equipmentCost += equipmentCost;
          console.log(`⚙️ Equipment: ₹${equipmentCost} (${courtEquipment.length} items)`);
        }
        
        // Lighting cost
        if (courtLighting.required) {
          const poleSpacing = 9.14;
          const poles = Math.ceil(courtPerimeter / poleSpacing);
          const lightsPerPole = Number(courtLighting.lightsPerPole) || 2;
          const lightType = courtLighting.type || 'standard';
          const lightCostPerUnit = pricing.lighting[lightType] || pricing.lighting.standard;
          const cost = poles * lightsPerPole * lightCostPerUnit;
          
          newPricing.lightingCost += cost;
          console.log(`💡 Lighting (${lightType}): ${poles} poles × ${lightsPerPole} lights × ₹${lightCostPerUnit} = ₹${cost}`);
        }
      });
    } else {
      console.log('🎯 Single court configuration detected');
      
      const reqSubbase = requirements.subbase || {};
      const reqFencing = requirements.fencing || {};
      const reqFlooring = requirements.flooring || {};
      const reqLighting = requirements.lighting || {};
      const reqEquipment = requirements.equipment || [];
      const reqDrainage = reqSubbase.drainage || {};
      
      // Subbase cost
      if (reqSubbase.type && pricing.subbase[reqSubbase.type]) {
        newPricing.subbaseCost = safeMultiply(projectArea, pricing.subbase[reqSubbase.type]);
        console.log(`🏗️ Subbase (${reqSubbase.type}): ${projectArea} m² × ₹${pricing.subbase[reqSubbase.type]} = ₹${newPricing.subbaseCost}`);
      }
      
      // Edgewall cost
      if (reqSubbase.edgewall) {
        newPricing.edgewallCost = safeMultiply(projectPerimeter, pricing.edgewall);
        console.log(`🧱 Edgewall: ${projectPerimeter} m × ₹${pricing.edgewall} = ₹${newPricing.edgewallCost}`);
      }
      
      // Drainage cost
      if (reqDrainage.required) {
        const drainageLength = Math.ceil(projectPerimeter / 4.5);
        newPricing.drainageCost = safeMultiply(drainageLength, pricing.drainage);
        console.log(`💧 Drainage: ${drainageLength} m × ₹${pricing.drainage} = ₹${newPricing.drainageCost}`);
      }
      
      // Fencing cost
      if (reqFencing.required && reqFencing.type && pricing.fencing[reqFencing.type]) {
        newPricing.fencingCost = safeMultiply(projectPerimeter, pricing.fencing[reqFencing.type]);
        console.log(`🔗 Fencing (${reqFencing.type}): ${projectPerimeter} m × ₹${pricing.fencing[reqFencing.type]} = ₹${newPricing.fencingCost}`);
      }
      
      // Flooring cost
      if (reqFlooring.type && pricing.flooring[reqFlooring.type]) {
        newPricing.flooringCost = safeMultiply(projectArea, pricing.flooring[reqFlooring.type]);
        console.log(`🏓 Flooring (${reqFlooring.type}): ${projectArea} m² × ₹${pricing.flooring[reqFlooring.type]} = ₹${newPricing.flooringCost}`);
      }
      
      // Equipment cost
      if (Array.isArray(reqEquipment)) {
        newPricing.equipmentCost = reqEquipment.reduce((total, item) => {
          return total + (Number(item.totalCost) || 0);
        }, 0);
        console.log(`⚙️ Equipment: ₹${newPricing.equipmentCost} (${reqEquipment.length} items)`);
      }
      
      // Lighting cost
      if (reqLighting.required) {
        const poleSpacing = 9.14;
        const poles = Math.ceil(projectPerimeter / poleSpacing);
        const lightsPerPole = Number(reqLighting.lightsPerPole) || 2;
        const lightType = reqLighting.type || 'standard';
        const lightCostPerUnit = pricing.lighting[lightType] || pricing.lighting.standard;
        
        newPricing.lightingCost = poles * lightsPerPole * lightCostPerUnit;
        console.log(`💡 Lighting (${lightType}): ${poles} poles × ${lightsPerPole} lights × ₹${lightCostPerUnit} = ₹${newPricing.lightingCost}`);
      }
    }
    
    // Calculate totals
    const costFields = ['subbaseCost', 'edgewallCost', 'drainageCost', 'fencingCost', 'flooringCost', 'equipmentCost', 'lightingCost'];
    newPricing.subtotal = costFields.reduce((sum, field) => {
      return sum + (Number(newPricing[field]) || 0);
    }, 0);
    
    newPricing.gstAmount = newPricing.subtotal * 0.18;
    newPricing.grandTotal = newPricing.subtotal + newPricing.gstAmount;
    
    // Ensure all values are numbers and rounded
    Object.keys(newPricing).forEach(key => {
      newPricing[key] = Math.round(Number(newPricing[key]) || 0);
    });

    console.log('💰 Final Pricing Calculation:');
    console.log('--------------------------------');
    costFields.forEach(field => {
      console.log(`${field}: ₹${newPricing[field]}`);
    });
    console.log(`Subtotal: ₹${newPricing.subtotal}`);
    console.log(`GST: ₹${newPricing.gstAmount}`);
    console.log(`Grand Total: ₹${newPricing.grandTotal}`);
    console.log('--------------------------------');

    return newPricing;

  } catch (error) {
    console.error('❌ Error in calculatePricingSafely:', error);
    throw error;
  }
};

// PDF Generation Function (keep the existing one, it's working)
const generateQuotationPDF = (quotation) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 15,
        size: 'A4'
      });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 15;
      
      let yPosition = margin;

      const checkNewPage = (spaceNeeded = 10) => {
        if (yPosition + spaceNeeded > pageHeight - 50) {
          doc.addPage();
          yPosition = margin;
          addHeader();
          return true;
        }
        return false;
      };

      const addHeader = () => {
        doc.rect(0, 0, pageWidth, 35).fill('#f44237');
        doc.fillColor('white')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('NEXORA GROUP', margin + 33, 12);
        doc.fontSize(8)
           .font('Helvetica')
           .text('Sports Infrastructure Solutions', margin + 33, 22);
        doc.fontSize(7)
           .text('+91-8431322728', pageWidth - margin, 10, { align: 'right' })
           .text('info.nexoragroup@gmail.com', pageWidth - margin, 17, { align: 'right' })
           .text('www.nexoragroup.com', pageWidth - margin, 24, { align: 'right' });
        doc.fillColor('black');
        yPosition = 45;
      };

      addHeader();

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
      const clientInfo = quotation.clientInfo || {};
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Name: ${clientInfo.name || 'N/A'}`, margin, yPosition);
      
      yPosition += 4;
      doc.text(`Email: ${clientInfo.email || 'N/A'}`, margin, yPosition);
      
      yPosition += 4;
      doc.text(`Phone: ${clientInfo.phone || 'N/A'}`, margin, yPosition);
      
      yPosition += 4;
      
      const addressText = `Address: ${clientInfo.address || 'N/A'}`;
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
      const projectInfo = quotation.projectInfo || {};
      const sports = projectInfo.sports || [];
      const sportNames = sports.map(s => s?.sport?.replace(/-/g, ' ').toUpperCase()).join(', ') || 
                        (projectInfo.sport ? projectInfo.sport.replace(/-/g, ' ').toUpperCase() : 'SPORTS COURT');
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Proposal for ${sportNames} ${projectInfo.constructionType?.toUpperCase() || 'STANDARD'}`, margin, yPosition);
      
      yPosition += 4;
      doc.text(`Area: ${projectInfo.area || 0} sq. meters`, margin, yPosition);
      
      yPosition += 4;
      doc.text(`Perimeter: ${projectInfo.perimeter || 0} meters`, margin, yPosition);
      
      yPosition += 10;

      // Requirements Section
      checkNewPage(30);
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('CONSTRUCTION REQUIREMENTS:', margin, yPosition);
      
      yPosition += 8;
      
      const requirements = quotation.requirements || {};
      const courtRequirements = requirements.courtRequirements || {};
      const hasMultipleCourts = Object.keys(courtRequirements).length > 0;

      if (hasMultipleCourts) {
        Object.values(courtRequirements).forEach((court, index) => {
          if (!court) return;
          
          checkNewPage(40);
          doc.fontSize(9)
             .font('Helvetica-Bold')
             .text(`${court.sport?.toUpperCase() || 'COURT'} - Court ${court.courtNumber || index + 1}`, margin, yPosition);
          
          yPosition += 6;
          doc.fontSize(8)
             .font('Helvetica')
             .text(`Subbase: ${court.subbase?.type || 'Not specified'}${court.subbase?.edgewall ? ' + Edgewall' : ''}${court.subbase?.drainage?.required ? ' + Drainage' : ''}`, margin, yPosition);
          
          yPosition += 4;
          doc.text(`Flooring: ${court.flooring?.type || 'Not specified'}`, margin, yPosition);
          
          yPosition += 4;
          doc.text(`Fencing: ${court.fencing?.required ? court.fencing.type || 'Yes' : 'No'}`, margin, yPosition);
          
          yPosition += 4;
          doc.text(`Lighting: ${court.lighting?.required ? court.lighting.type || 'Yes' : 'No'}`, margin, yPosition);
          
          yPosition += 8;
        });
      } else {
        doc.fontSize(8)
           .font('Helvetica')
           .text(`Subbase: ${requirements.subbase?.type || 'Not specified'}${requirements.subbase?.edgewall ? ' + Edgewall' : ''}${requirements.subbase?.drainage?.required ? ' + Drainage' : ''}`, margin, yPosition);
        
        yPosition += 4;
        doc.text(`Flooring: ${requirements.flooring?.type || 'Not specified'}`, margin, yPosition);
        
        yPosition += 4;
        doc.text(`Fencing: ${requirements.fencing?.required ? requirements.fencing.type || 'Yes' : 'No'}`, margin, yPosition);
        
        yPosition += 4;
        doc.text(`Lighting: ${requirements.lighting?.required ? requirements.lighting.type || 'Yes' : 'No'}`, margin, yPosition);
        
        yPosition += 8;
      }

      // Price Breakdown Table
      checkNewPage(50);
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('PRICE BREAKDOWN', margin, yPosition);
      
      yPosition += 8;
      
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('Description', margin, yPosition)
         .text('Amount (₹)', pageWidth - margin, yPosition, { align: 'right' });
      
      yPosition += 5;
      doc.moveTo(margin, yPosition).lineTo(pageWidth - margin, yPosition).strokeColor('#333').stroke();
      
      yPosition += 8;
      const pricing = quotation.pricing || {};

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

      const addFooter = () => {
        const footerY = pageHeight - 20;
        doc.rect(0, footerY, pageWidth, 20).fill('#f44237');
        doc.fillColor('white')
           .fontSize(7)
           .font('Helvetica')
           .text('NEXORA GROUP - Sports Infrastructure Solutions | Jalahalli West, Bangalore-560015', 
                 pageWidth/2, footerY + 6, { align: 'center' })
           .text('+91 8431322728 | info.nexoragroup@gmail.com | www.nexoragroup.com', 
                 pageWidth/2, footerY + 13, { align: 'center' });
      };

      addFooter();

      doc.fillColor(100, 100, 100)
         .fontSize(8)
         .text('Page 1 of 1', pageWidth/2, pageHeight - 30, { align: 'center' });

      doc.end();

    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      reject(error);
    }
  });
}

// Email sending function with PDF attachment
const sendQuotationEmailWithPDF = async (quotation) => {
  try {
    console.log('📧 Generating PDF for quotation...');
    
    const pdfBuffer = await generateQuotationPDF(quotation);
    
    console.log('📧 PDF generated successfully, preparing email...');

    const projectInfo = quotation.projectInfo || {};
    const sports = projectInfo.sports || [];
    const sportNames = sports.map(s => s?.sport?.replace(/-/g, ' ').toUpperCase()).join(', ') || 
                      (projectInfo.sport ? projectInfo.sport.replace(/-/g, ' ').toUpperCase() : 'SPORTS COURT');

    const clientInfo = quotation.clientInfo || {};

    const mailOptions = {
      from: `"Nexora Group" <${process.env.EMAIL_USER || 'info.nexoragroup@gmail.com'}>`,
      to: clientInfo.email,
      subject: `Your Approved Quotation #${quotation.quotationNumber} - Nexora Group`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px; }
                .quotation-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db; }
                .price-highlight { font-size: 20px; font-weight: bold; color: #2c3e50; background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; }
                .button { background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 10px 5px; }
                .footer { background: #2c3e50; color: white; padding: 20px; text-align: center; font-size: 12px; border-radius: 5px; margin-top: 20px; }
                .attachment-note { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 style="margin: 0; font-size: 28px;">NEXORA GROUP</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Sports Infrastructure Solutions</p>
            </div>
            
            <div class="content">
                <h2 style="color: #27ae60; text-align: center;">🎉 Your Quotation Has Been Approved!</h2>
                
                <p>Dear <strong>${clientInfo.name || 'Valued Client'}</strong>,</p>
                
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
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${projectInfo.constructionType || 'Standard'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;"><strong>Area:</strong></td>
                            <td style="padding: 8px 0;">${projectInfo.area || 0} sq. meters</td>
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
    console.log(`✅ Email with PDF sent successfully to ${clientInfo.email}`);
    
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

// Get single quotation with detailed requirements
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
      const sanitizedPricing = {};
      Object.keys(pricing).forEach(key => {
        sanitizedPricing[key] = Number(pricing[key]) || 0;
      });
      quotation.pricing = { 
        ...quotation.pricing,
        ...sanitizedPricing 
      };
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

// NEW: Fixed Approve quotation with PDF email
router.post('/quotations/:id/approve', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    console.log('✅ Starting approval process for quotation:', quotation.quotationNumber);
    
    // Calculate pricing safely without modifying the original quotation
    let newPricing = null;
    try {
      console.log('💰 Recalculating pricing safely...');
      newPricing = await calculatePricingSafely(quotation);
      console.log('✅ Pricing calculation completed');
    } catch (calcError) {
      console.error('❌ Error recalculating pricing during approval:', calcError.message);
      // Use existing pricing if recalculation fails
      newPricing = quotation.pricing || {};
    }
    
    // Update only the necessary fields - don't modify requirements or projectInfo
    const updateData = {
      status: 'approved',
      adminNotes: req.body.notes || '',
      approvedAt: new Date(),
      approvedBy: req.user.username,
      updatedAt: new Date()
    };
    
    // Only update pricing if we have valid new pricing
    if (newPricing && newPricing.grandTotal > 0) {
      updateData.pricing = newPricing;
    }
    
    console.log('💾 Updating quotation with new data...');
    const updatedQuotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Quotation updated successfully');
    
    // Send email with PDF attachment using the updated quotation
    console.log('📧 Sending email with PDF...');
    const emailResult = await sendQuotationEmailWithPDF(updatedQuotation);
    
    if (emailResult.success) {
      console.log('✅ Email sent successfully');
      res.json({ 
        message: 'Quotation approved and PDF sent to client via email!', 
        quotation: updatedQuotation,
        emailSent: true,
        pdfAttached: true,
        recipient: updatedQuotation.clientInfo.email
      });
    } else {
      console.log('❌ Email failed to send');
      res.json({ 
        message: 'Quotation approved but email with PDF failed to send. Please contact the client manually.', 
        quotation: updatedQuotation,
        emailSent: false,
        pdfAttached: false,
        emailError: emailResult.error,
        recipient: updatedQuotation.clientInfo.email
      });
    }
    
  } catch (error) {
    console.error('❌ Error approving quotation:', error);
    res.status(500).json({ message: 'Error approving quotation: ' + error.message });
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