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
    if (!obj) return defaultValue;
    return path.split('.').reduce((acc, part) => {
      if (acc === null || acc === undefined) return defaultValue;
      return acc[part];
    }, obj) || defaultValue;
  };

  // Initialize safe form data with extensive fallbacks
  const safeFormData = {
    projectInfo: getSafeValue(formData, 'projectInfo', {
      area: 0,
      perimeter: 0,
      sports: [],
      constructionType: '',
      sport: '',
      unit: 'meters',
      length: 0,
      width: 0
    }),
    requirements: getSafeValue(formData, 'requirements', {
      subbase: { 
        type: '', 
        edgewall: false, 
        drainage: { required: false, slope: 0 } 
      },
      flooring: { type: '' },
      fencing: { required: false, type: '', length: 0 },
      lighting: { required: false, type: 'standard', poles: 0, lightsPerPole: 2 },
      equipment: [],
      courtRequirements: {}
    }),
    clientInfo: getSafeValue(formData, 'clientInfo', {
      name: '',
      email: '',
      phone: '',
      address: '',
      purpose: ''
    })
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
    
    // Validate client info
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
    if (!clientInfo.purpose?.trim()) {
      setError('Please complete client information in the first step');
      return false;
    }

    // Check if we have multiple courts
    const courtRequirements = safeFormData.requirements.courtRequirements;
    const hasMultipleCourts = courtRequirements && Object.keys(courtRequirements).length > 0;
    
    if (hasMultipleCourts) {
      // Validate each court
      for (const courtKey in courtRequirements) {
        const court = courtRequirements[courtKey];
        
        if (!court.subbase || !court.subbase.type) {
          setError(`Please select subbase type for ${court.sport || 'Unknown'} Court ${court.courtNumber || '1'}`);
          return false;
        }
        if (!court.flooring || !court.flooring.type) {
          setError(`Please select flooring type for ${court.sport || 'Unknown'} Court ${court.courtNumber || '1'}`);
          return false;
        }
      }
    } else {
      // Validate single court
      if (!safeFormData.requirements.subbase || !safeFormData.requirements.subbase.type) {
        setError('Please select subbase type in the requirements section');
        return false;
      }
      if (!safeFormData.requirements.flooring || !safeFormData.requirements.flooring.type) {
        setError('Please select flooring type in the requirements section');
        return false;
      }
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

      const response = await axios.post('http://localhost:5000/api/quotations', completeFormData);
      const newQuotation = response.data;
      
      setQuotation(newQuotation.quotation || newQuotation);
      
    } catch (error) {
      console.error('Error generating quotation:', error);
      const errorMessage = error.response?.data?.message || 'Error generating quotation. Please check your inputs and try again.';
      setError(errorMessage);
    }
    setLoading(false);
  };

  const downloadPDF = () => {
    if (!quotation) return;
    
    const doc = new jsPDF();
    
    // Add header
    doc.setFillColor(44, 62, 80);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('NEXORA GROUP', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Sports Infrastructure Solutions', 105, 22, { align: 'center' });
    
    // Add quotation details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('QUOTATION', 105, 50, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Quotation Number: ${quotation.quotationNumber}`, 20, 65);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 72);
    
    // Add client information
    doc.setFontSize(12);
    doc.text('Client Information:', 20, 85);
    doc.setFontSize(10);
    doc.text(`Name: ${quotation.clientInfo.name}`, 20, 95);
    doc.text(`Email: ${quotation.clientInfo.email}`, 20, 102);
    doc.text(`Phone: ${quotation.clientInfo.phone}`, 20, 109);
    doc.text(`Address: ${quotation.clientInfo.address}`, 20, 116);
    
    // Add pricing
    let yPosition = 140;
    doc.setFontSize(12);
    doc.text('Pricing Breakdown:', 20, yPosition);
    
    yPosition += 10;
    if (quotation.pricing) {
      Object.entries(quotation.pricing).forEach(([key, value]) => {
        if (value > 0 && key !== 'subtotal' && key !== 'gstAmount' && key !== 'grandTotal') {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          doc.text(`${label}: ₹${value.toLocaleString()}`, 30, yPosition);
          yPosition += 7;
        }
      });
      
      doc.text(`Subtotal: ₹${quotation.pricing.subtotal.toLocaleString()}`, 30, yPosition);
      yPosition += 7;
      doc.text(`GST (18%): ₹${quotation.pricing.gstAmount.toLocaleString()}`, 30, yPosition);
      yPosition += 7;
      doc.setFontSize(14);
      doc.text(`Grand Total: ₹${quotation.pricing.grandTotal.toLocaleString()}`, 30, yPosition);
    }
    
    // Save the PDF
    doc.save(`quotation-${quotation.quotationNumber}.pdf`);
  };

  return (
    <div className="form-container">
      <h2>Quotation Summary</h2>
      
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {quotation ? (
        <div className="quotation-result">
          <div className="success-message">
            <h3>✅ Quotation Generated Successfully!</h3>
            <p><strong>Quotation Number:</strong> {quotation.quotationNumber}</p>
            <p><strong>Client:</strong> {quotation.clientInfo.name}</p>
            <p><strong>Email:</strong> {quotation.clientInfo.email}</p>
            <p><strong>Total Amount:</strong> ₹{quotation.pricing?.grandTotal?.toLocaleString() || '0'}</p>
            <p className="info-note">
              Within 24 hours, we will send the detailed quotation to your email address.
            </p>
          </div>
          
          <div className="button-group">
            <button type="button" onClick={downloadPDF} className="btn-primary">
              📄 Download PDF
            </button>
            <button type="button" onClick={() => window.location.reload()} className="btn-secondary">
              🏠 Create New Quotation
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="section">
            <h3>Project Overview</h3>
            <div className="summary-details">
              <div className="info-grid">
                <div><strong>Client Name:</strong> {safeFormData.clientInfo.name || 'Not provided'}</div>
                <div><strong>Email:</strong> {safeFormData.clientInfo.email || 'Not provided'}</div>
                <div><strong>Phone:</strong> {safeFormData.clientInfo.phone || 'Not provided'}</div>
                <div><strong>Construction Type:</strong> {safeFormData.projectInfo.constructionType || 'Not selected'}</div>
                <div><strong>Sports:</strong> {safeFormData.projectInfo.sports?.map(s => s.sport).join(', ') || 'Not selected'}</div>
                <div><strong>Area:</strong> {safeFormData.projectInfo.area || 0} sq. meters</div>
              </div>
            </div>
          </div>

          <div className="button-group">
            <button type="button" onClick={prevStep} className="btn-secondary">
              Back to Requirements
            </button>
            <button 
              type="button" 
              onClick={generateQuotation} 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Generating Quotation...' : 'Generate Quotation'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default QuotationSummary;