import React, { useState } from 'react';

const ConstructionType = ({ data, updateData, nextStep, prevStep }) => {
  const [formData, setFormData] = useState({
    constructionType: data.constructionType || '',
    unit: data.unit || 'meters',
    length: data.length || '',
    width: data.width || ''
  });

  const [showDimensions, setShowDimensions] = useState(false);

  const handleTypeChange = (type) => {
    const updatedData = {
      constructionType: type,
      unit: formData.unit,
      length: type === 'standard' ? '' : formData.length,
      width: type === 'standard' ? '' : formData.width
    };
    
    setFormData(updatedData);
    setShowDimensions(type !== 'standard');
  };

  const handleUnitChange = (unit) => {
    setFormData({
      ...formData,
      unit
    });
  };

  const handleDimensionChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.constructionType) {
      alert('Please select construction type');
      return;
    }
    
    if (formData.constructionType !== 'standard' && (!formData.length || !formData.width)) {
      alert('Please enter length and width');
      return;
    }
    
    updateData(formData);
    nextStep();
  };

  const calculateArea = () => {
    if (formData.length && formData.width) {
      const area = formData.length * formData.width;
      const unit = formData.unit === 'meters' ? 'sq. meters' : 'sq. feet';
      return `${area.toLocaleString()} ${unit}`;
    }
    return '';
  };

  return (
    <div className="form-container">
      <h2>Construction Type</h2>
      <form onSubmit={handleSubmit}>
        <div className="section">
          <h3>Select Construction Type</h3>
          <div className="construction-type-selection">
            <div
              className={`type-card ${formData.constructionType === 'standard' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('standard')}
            >
              <h4>🏟️ Standard Size</h4>
              <p>Official competition dimensions</p>
              <ul>
                <li>Pre-defined sizes</li>
                <li>Tournament ready</li>
                <li>Professional specifications</li>
              </ul>
            </div>

            <div
              className={`type-card ${formData.constructionType === 'non-standard' ? 'selected' : ''}`}
              onClick={() => handleTypeChange('non-standard')}
            >
              <h4>📐 Custom Size</h4>
              <p>Custom dimensions to fit your space</p>
              <ul>
                <li>Flexible dimensions</li>
                <li>Space optimization</li>
                <li>Custom design</li>
              </ul>
            </div>
          </div>
        </div>

        {showDimensions && (
          <div className="section">
            <h3>Enter Ground Dimensions</h3>
            
            <div className="unit-selection">
              <label>Measurement Unit:</label>
              <div className="unit-buttons">
                <button
                  type="button"
                  className={`unit-btn ${formData.unit === 'meters' ? 'active' : ''}`}
                  onClick={() => handleUnitChange('meters')}
                >
                  Meters
                </button>
                <button
                  type="button"
                  className={`unit-btn ${formData.unit === 'feet' ? 'active' : ''}`}
                  onClick={() => handleUnitChange('feet')}
                >
                  Feet
                </button>
              </div>
            </div>

            <div className="dimension-inputs">
              <div className="form-group">
                <label>Length ({formData.unit})</label>
                <input
                  type="number"
                  value={formData.length}
                  onChange={(e) => handleDimensionChange('length', e.target.value)}
                  required
                  min="1"
                  step="0.1"
                  placeholder={`Enter length in ${formData.unit}`}
                />
              </div>

              <div className="form-group">
                <label>Width ({formData.unit})</label>
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => handleDimensionChange('width', e.target.value)}
                  required
                  min="1"
                  step="0.1"
                  placeholder={`Enter width in ${formData.unit}`}
                />
              </div>
            </div>

            {calculateArea() && (
              <div className="area-calculation">
                <h4>Calculated Area: {calculateArea()}</h4>
              </div>
            )}
          </div>
        )}

        <div className="button-group">
          <button type="button" onClick={prevStep} className="btn-secondary">
            Back
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={!formData.constructionType || (showDimensions && (!formData.length || !formData.width))}
          >
            Next: Select Sports
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConstructionType;