const express = require('express');
const Quotation = require('../models/Quotation');
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

// PDF Generation Function
const generateQuotationPDF = (quotation) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      // Collect PDF data
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Add Header with background
      doc.rect(0, 0, 612, 100).fill('#2c3e50');
      
      // Company Logo and Name
      doc.fillColor('white')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('NEXORA GROUP', 50, 30);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text('Sports Infrastructure Solutions', 50, 55);
      
      // Contact info on header
      doc.fontSize(8)
         .text('📞 +91-8431322728', 450, 30)
         .text('📧 info.nexoragroup@gmail.com', 450, 45)
         .text('🌐 www.nexoragroup.com', 450, 60);

      doc.fillColor('black');

      // Quotation Title
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('APPROVED QUOTATION', 50, 120, { align: 'center' });

      // Quotation Details
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Quotation Number: ${quotation.quotationNumber}`, 50, 160)
         .text(`Date: ${new Date(quotation.approvedAt).toLocaleDateString('en-IN')}`, 450, 160)
         .text(`Status: APPROVED`, 50, 175);

      // Client Information Section
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('CLIENT INFORMATION', 50, 210);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Name: ${quotation.clientInfo.name}`, 50, 235)
         .text(`Email: ${quotation.clientInfo.email}`, 50, 250)
         .text(`Phone: ${quotation.clientInfo.phone}`, 50, 265)
         .text(`Address: ${quotation.clientInfo.address}`, 50, 280, { width: 300 });

      // Project Details
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('PROJECT DETAILS', 50, 320);
      
      const sportName = quotation.projectInfo.sport ? 
        quotation.projectInfo.sport.replace(/-/g, ' ').toUpperCase() : 'SPORTS COURT';
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Project: ${sportName} Construction`, 50, 345)
         .text(`Construction Type: ${quotation.projectInfo.constructionType || 'Standard'}`, 50, 360)
         .text(`Area: ${quotation.projectInfo.area || 0} sq. meters`, 50, 375)
         .text(`Perimeter: ${quotation.projectInfo.perimeter || 0} meters`, 50, 390);

      // Price Breakdown Table
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('PRICE BREAKDOWN', 50, 430);

      let yPosition = 455;
      const pricing = quotation.pricing || {};

      // Table Headers
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Description', 50, yPosition)
         .text('Amount (₹)', 450, yPosition, { align: 'right' });
      
      yPosition += 20;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();

      // Price Rows
      const addPriceRow = (description, amount) => {
        if (amount > 0) {
          yPosition += 15;
          doc.fontSize(9)
             .font('Helvetica')
             .text(description, 50, yPosition)
             .text(amount.toLocaleString('en-IN'), 450, yPosition, { align: 'right' });
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
      yPosition += 30;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      
      yPosition += 15;
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Subtotal:', 350, yPosition)
         .text((pricing.subtotal || 0).toLocaleString('en-IN'), 450, yPosition, { align: 'right' });
      
      yPosition += 15;
      doc.text('GST @18%:', 350, yPosition)
         .text((pricing.gstAmount || 0).toLocaleString('en-IN'), 450, yPosition, { align: 'right' });
      
      yPosition += 20;
      doc.fontSize(12)
         .text('GRAND TOTAL:', 350, yPosition)
         .text((pricing.grandTotal || 0).toLocaleString('en-IN'), 450, yPosition, { align: 'right' });

      // Admin Notes
      if (quotation.adminNotes) {
        yPosition += 40;
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('SPECIAL NOTES:', 50, yPosition);
        
        yPosition += 15;
        doc.fontSize(9)
           .font('Helvetica')
           .text(quotation.adminNotes, 50, yPosition, { width: 500 });
      }

      // Footer
      const footerY = 750;
      doc.rect(0, footerY, 612, 50).fill('#34495e');
      
      doc.fillColor('white')
         .fontSize(8)
         .text('NEXORA GROUP - Sports Infrastructure Solutions', 50, footerY + 15)
         .text('Jalahalli West, Bangalore 560015 | +91 8431322728', 50, footerY + 30)
         .text('info.nexoragroup@gmail.com | www.nexoragroup.com', 50, footerY + 45);

      doc.end();

    } catch (error) {
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
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${quotation.projectInfo.sport ? quotation.projectInfo.sport.replace(/-/g, ' ').toUpperCase() : 'Sports Court'} Construction</td>
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