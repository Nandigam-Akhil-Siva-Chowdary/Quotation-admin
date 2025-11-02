import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';

const QuotationSummary = ({ formData, prevStep, updateData }) => {
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pricingData, setPricingData] = useState(null);

  // Safe data access function
  const getSafeValue = (obj, path, defaultValue) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) || defaultValue;
  };

  // Initialize safe form data
  const safeFormData = {
    projectInfo: getSafeValue(formData, 'projectInfo', {
      area: 260,
      perimeter: 0,
      sports: [],
      constructionType: 'standard',
      sport: '',
      unit: 'meters',
      length: 0,
      width: 0
    }),
    requirements: getSafeValue(formData, 'requirements', {
      subbase: { type: '', edgewall: false, drainage: { required: false, slope: 0 } },
      flooring: { type: '', area: 260 },
      fencing: { required: false, type: '', length: 0 },
      lighting: { required: false, type: 'standard', poles: 0, lightsPerPole: 2 },
      equipment: []
    }),
    clientInfo: getSafeValue(formData, 'clientInfo', {})
  };

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/pricing');
        setPricingData(response.data);
      } catch (error) {
        console.error('Error fetching pricing data:', error);
      }
    };
    fetchPricing();
  }, []);

  const formatIndianRupees = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const validateForm = () => {
    const clientInfo = safeFormData.clientInfo;
    
    if (!clientInfo.name?.trim()) {
      setError('Please complete client information in the first step');
      return false;
    }
    if (!clientInfo.email?.trim()) {
      setError('Please complete client information in the first step');
      return false;
    }
    if (!clientInfo.phone?.trim()) {
      setError('Please complete client information in the first step');
      return false;
    }
    if (!clientInfo.address?.trim()) {
      setError('Please complete client information in the first step');
      return false;
    }
    if (!clientInfo.purpose?.trim()) {
      setError('Please complete client information in the first step');
      return false;
    }
    
    // Check for subbase and flooring types
    if (!safeFormData.requirements.subbase.type || !safeFormData.requirements.flooring.type) {
      setError('Construction requirements are incomplete. Please go back and select subbase and flooring types.');
      return false;
    }

    setError('');
    return true;
  };

  const generateQuotation = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const completeFormData = {
        clientInfo: safeFormData.clientInfo,
        projectInfo: safeFormData.projectInfo,
        requirements: safeFormData.requirements
      };

      console.log('Sending quotation data:', completeFormData);

      const response = await axios.post('http://localhost:5000/api/quotations', completeFormData);
      const newQuotation = response.data;
      
      setQuotation(newQuotation.quotation || newQuotation);
      
      // Show success message
      <div className="success-message">
        <h2>✅ Quotation Request Submitted Successfully!</h2>
        <p>Your quotation request has been received. Once approved by our team, we will send the detailed quotation PDF to your email address: <strong>{newQuotation.clientInfo?.email}</strong></p>
        <p>Our team will review your requirements and get back to you within 24 hours.</p>
      </div>
      
    } catch (error) {
      console.error('Error generating quotation:', error);
      const errorMessage = error.response?.data?.message || 'Error generating quotation. Please check your inputs and try again.';
      setError(errorMessage);
    }
    setLoading(false);
  };

  const downloadPDF = async (quotationData = quotation) => {
    if (!quotationData) {
      alert('No quotation data available to download');
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Set margins and column positions
      const margin = 15;
      const pageWidth = 210;
      const col1 = margin + 8;
      const col2 = margin + 115;
      const col3 = margin + 142;
      const col4 = margin + 170;
      
      let yPosition = margin;
      
      const checkNewPage = (spaceNeeded = 10) => {
        if (yPosition + spaceNeeded > 270) {
          doc.addPage();
          yPosition = margin;
          addHeader();
          return true;
        }
        return false;
      };

      const addHeader = async () => {
        doc.setFillColor(244, 66, 55);
        doc.rect(0, 0, pageWidth, 35, 'F');
        
        try {
          const logoUrl = '/nexoralogo.jpg';
          const logoWidth = 25;
          const logoHeight = 25;
          const logoX = margin;
          const logoY = 5;
          
          doc.addImage(logoUrl, 'JPEG', logoX, logoY, logoWidth, logoHeight);
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('NEXORA GROUP', logoX + logoWidth + 8, logoY + 10);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text('Sports Infrastructure Solutions', logoX + logoWidth + 8, logoY + 15);
          
        } catch (logoError) {
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('NEXORA GROUP', pageWidth / 2, 12, { align: 'center' });
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text('Sports Infrastructure Solutions', pageWidth / 2, 18, { align: 'center' });
        }
        
        doc.setFontSize(7);
        doc.text('+91-8431322728', pageWidth - margin, 10, { align: 'right' });
        doc.text('info.nexoragroup@gmail.com', pageWidth - margin, 15, { align: 'right' });
        doc.text('www.nexoragroup.com', pageWidth - margin, 20, { align: 'right' });
        
        doc.setTextColor(0, 0, 0);
        yPosition = 45;
      };

      await addHeader();

      // Quotation title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('QUOTATION FOR SPORTS COURT CONSTRUCTION', pageWidth/2, yPosition, { align: 'center' });
      
      yPosition += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ref. No: ${quotationData.quotationNumber || 'NXR000001'}`, margin, yPosition);
      doc.text(`Date: ${new Date(quotationData.createdAt).toLocaleDateString('en-IN')}`, pageWidth - margin, yPosition, { align: 'right' });
      
      // Client information
      yPosition += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENT DETAILS:', margin, yPosition);
      yPosition += 5;
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${quotationData.clientInfo?.name || 'N/A'}`, margin, yPosition);
      yPosition += 4;
      doc.text(`Email: ${quotationData.clientInfo?.email || 'N/A'}`, margin, yPosition);
      yPosition += 4;
      doc.text(`Phone: ${quotationData.clientInfo?.phone || 'N/A'}`, margin, yPosition);
      yPosition += 4;
      const addressLines = doc.splitTextToSize(`Address: ${quotationData.clientInfo?.address || 'N/A'}`, 150);
      doc.text(addressLines, margin, yPosition);
      yPosition += (addressLines.length * 4) + 8;

      // Project Description
      checkNewPage(15);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PROPOSAL DETAILS', margin, yPosition);
      yPosition += 6;
      
      const sport = quotationData.projectInfo?.sport || 'Multi-Sport';
      const constructionType = quotationData.projectInfo?.constructionType || 'Standard';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Proposal for ${sport.replace(/-/g, ' ').toUpperCase()} ${constructionType.toUpperCase()}`, margin, yPosition);
      doc.text(`Area: ${getSafeValue(quotationData, 'pricing.area', 0)} sq. meters`, margin, yPosition + 4);
      yPosition += 10;

      // Footer
      const addFooter = () => {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFillColor(244, 66, 55);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('NEXORA GROUP - Sports Infrastructure Solutions | Jalahalli West, Bangalore-560015', 
                 pageWidth/2, pageHeight - 10, { align: 'center' });
        doc.text('+91 8431322728 | info.nexoragroup@gmail.com | www.nexoragroup.com', 
                 pageWidth/2, pageHeight - 5, { align: 'center' });
      };

      // Add footer to all pages
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter();
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth/2, doc.internal.pageSize.height - 20, { align: 'center' });
      }

      // Save PDF
      doc.save(`Nexora_Quotation_${quotationData.quotationNumber || 'NXR000001'}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  if (quotation) {
    return (
      <div className="quotation-container">
        <div className="company-letterhead">
          <h1>NEXORA GROUP</h1>
          <p>Sports Infrastructure Solutions</p>
        </div>
        
        <div className="success-message">
          <h2>✅ Quotation Generated Successfully!</h2>
          <p>Your quotation has been generated with dynamic pricing based on your requirements.</p>
          <p><strong>Quotation Number:</strong> {quotation.quotationNumber}</p>
          <p>We will send the detailed quotation to your email: <strong>{quotation.clientInfo?.email}</strong></p>
        </div>
        
        <div className="quotation-details">
          <div className="quotation-header">
            <h3>QUOTATION SUMMARY</h3>
            <p>Date: {new Date(quotation.createdAt).toLocaleDateString()}</p>
          </div>

          {/* Client Information */}
          <div className="section">
            <h4>Client Information</h4>
            <div className="info-grid">
              <div><strong>Name:</strong> {quotation.clientInfo?.name || 'N/A'}</div>
              <div><strong>Email:</strong> {quotation.clientInfo?.email || 'N/A'}</div>
              <div><strong>Phone:</strong> {quotation.clientInfo?.phone || 'N/A'}</div>
              <div><strong>Address:</strong> {quotation.clientInfo?.address || 'N/A'}</div>
              <div><strong>Purpose:</strong> {quotation.clientInfo?.purpose || 'N/A'}</div>
            </div>
          </div>

          {/* Project Details */}
          <div className="section">
            <h4>Project Details</h4>
            <div className="info-grid">
              <div><strong>Sport:</strong> {quotation.projectInfo?.sport || 'N/A'}</div>
              <div><strong>Construction Type:</strong> {quotation.projectInfo?.constructionType || 'N/A'}</div>
              <div><strong>Area:</strong> {getSafeValue(quotation, 'pricing.area', 0)} sq. meters</div>
            </div>
          </div>

          {/* Action Buttons - Only show download and new quotation */}
          <div className="button-group">
            <button onClick={() => downloadPDF()} className="btn-secondary">Download PDF</button>
            <button onClick={() => window.location.reload()} className="btn-primary">Create New Quotation</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <h2>Quotation Summary</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="section">
        <h3>Project Overview</h3>
        <div className="summary-details">
          <div className="info-grid">
            <div><strong>Client Name:</strong> {safeFormData.clientInfo.name || 'Not provided'}</div>
            <div><strong>Email:</strong> {safeFormData.clientInfo.email || 'Not provided'}</div>
            <div><strong>Phone:</strong> {safeFormData.clientInfo.phone || 'Not provided'}</div>
            <div><strong>Construction Type:</strong> {safeFormData.projectInfo.constructionType || 'Not selected'}</div>
            <div><strong>Sport:</strong> {safeFormData.projectInfo.sport || 'Not selected'}</div>
            <div><strong>Area:</strong> {safeFormData.projectInfo.area || 0} sq. meters</div>
          </div>
        </div>
      </div>

      <div className="button-group">
        <button type="button" onClick={prevStep} className="btn-secondary">Back to Requirements</button>
        <button 
          type="button" 
          onClick={generateQuotation} 
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Generating Quotation...' : 'Generate Quotation'}
        </button>
      </div>
    </div>
  );
};

export default QuotationSummary;