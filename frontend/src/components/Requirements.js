import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Requirements = ({ data, updateData, nextStep, prevStep, projectInfo }) => {
  const [courtRequirements, setCourtRequirements] = useState(data.courtRequirements || {});
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pricingRes = await axios.get('http://localhost:5000/api/pricing');
        setPricing(pricingRes.data);

        // Fetch equipment for each selected sport
        const equipmentPromises = projectInfo.sports.map(sportItem => 
          axios.get(`http://localhost:5000/api/sports-config/equipment/${sportItem.sport}`)
        );
        
        const equipmentResponses = await Promise.all(equipmentPromises);
        const equipmentData = {};
        
        projectInfo.sports.forEach((sportItem, index) => {
          equipmentData[sportItem.sport] = equipmentResponses[index].data.map(item => ({
            ...item,
            quantity: Number(item.quantity) || 1,
            totalCost: Number(item.unitCost) * (Number(item.quantity) || 1)
          }));
        });
        
        // Initialize requirements for each court
        const initialRequirements = {};
        projectInfo.sports.forEach(sportItem => {
          for (let i = 0; i < sportItem.quantity; i++) {
            const courtKey = `${sportItem.sport}-${i}`;
            initialRequirements[courtKey] = data.courtRequirements?.[courtKey] || {
              sport: sportItem.sport,
              courtNumber: i + 1,
              subbase: { type: '', edgewall: false, drainage: { required: false, slope: 0 } },
              flooring: { type: '', area: '' },
              fencing: { required: false, type: '', length: 0 },
              lighting: { required: false, type: 'standard', poles: 0, lightsPerPole: 2 },
              equipment: equipmentData[sportItem.sport] || []
            };
          }
        });
        
        setCourtRequirements(initialRequirements);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (projectInfo.sports && projectInfo.sports.length > 0) {
      fetchData();
    }
  }, [projectInfo.sports]); // Removed data.courtRequirements from dependencies

  const handleCourtChange = (courtKey, section, field, value) => {
    setCourtRequirements(prev => ({
      ...prev,
      [courtKey]: {
        ...prev[courtKey],
        [section]: {
          ...prev[courtKey][section],
          [field]: value
        }
      }
    }));
  };

  const handleCourtDrainageChange = (courtKey, field, value) => {
    setCourtRequirements(prev => ({
      ...prev,
      [courtKey]: {
        ...prev[courtKey],
        subbase: {
          ...prev[courtKey].subbase,
          drainage: {
            ...prev[courtKey].subbase.drainage,
            [field]: value
          }
        }
      }
    }));
  };

  const handleEquipmentChange = (courtKey, index, field, value) => {
    const updatedEquipment = [...courtRequirements[courtKey].equipment];
    
    if (field === 'quantity') {
      const quantity = Number(value) || 1;
      updatedEquipment[index] = {
        ...updatedEquipment[index],
        quantity: quantity,
        totalCost: (Number(updatedEquipment[index].unitCost) || 0) * quantity
      };
    } else {
      updatedEquipment[index] = {
        ...updatedEquipment[index],
        [field]: value
      };
    }
    
    setCourtRequirements(prev => ({
      ...prev,
      [courtKey]: {
        ...prev[courtKey],
        equipment: updatedEquipment
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate all courts have required fields
    for (const courtKey in courtRequirements) {
      const court = courtRequirements[courtKey];
      if (!court.subbase.type || !court.flooring.type) {
        alert(`Please select subbase and flooring types for ${court.sport} Court ${court.courtNumber}`);
        return;
      }
    }

    updateData({
      ...data,
      courtRequirements: courtRequirements
    });
    nextStep();
  };

  const getFlooringOptions = (sportType) => {
    const sportFlooring = {
      'basketball': [
        { value: 'acrylic', label: 'Acrylic Surface' },
        { value: 'concrete', label: 'Concrete Flooring' },
        { value: 'polyurethane', label: 'Polyurethane' }
      ],
      'badminton': [
        { value: 'wooden', label: 'Wooden Flooring' },
        { value: 'pvc', label: 'PVC Flooring' },
        { value: 'rubber', label: 'Rubber Flooring' }
      ],
      'boxcricket': [
        { value: 'concrete', label: 'Concrete Flooring' },
        { value: 'synthetic-turf', label: 'Synthetic Turf' }
      ],
      'football': [
        { value: 'natural-grass', label: 'Natural Grass' },
        { value: 'synthetic-turf', label: 'Synthetic Turf' }
      ],
      'tennis': [
        { value: 'acrylic', label: 'Acrylic Surface' },
        { value: 'clay', label: 'Clay Court' },
        { value: 'concrete', label: 'Concrete Flooring' }
      ],
      'volleyball': [
        { value: 'acrylic', label: 'Acrylic Surface' },
        { value: 'wooden', label: 'Wooden Flooring' },
        { value: 'concrete', label: 'Concrete Flooring' }
      ],
      'pickleball': [
        { value: 'acrylic', label: 'Acrylic Surface' },
        { value: 'concrete', label: 'Concrete Flooring' }
      ]
    };

    return sportFlooring[sportType] || [
      { value: 'concrete', label: 'Concrete Flooring' },
      { value: 'synthetic-turf', label: 'Synthetic Turf' }
    ];
  };

  const getFencingOptions = (sportType) => {
    const sportFencing = {
      'football': 'garnware',
      'boxcricket': 'garnware',
      'badminton': 'aluminium'
    };

    // Remove unused variable and return options directly
    return [
      { value: 'chainlink', label: 'Chain Link Fencing' },
      { value: 'metal', label: 'Metal Fencing' },
      { value: 'garnware', label: 'Garnware Fencing' },
      { value: 'aluminium', label: 'Aluminium Fencing' }
    ];
  };

  const getLightingOptions = (sportType) => {
    if (sportType === 'badminton') {
      return [
        { value: 'neon', label: 'Neon Lights' },
        { value: 'antiglare', label: 'Anti-Glare Lights' },
        { value: 'long', label: 'Long Beam Lights' }
      ];
    }
    
    return [
      { value: 'standard', label: 'Standard LED (150W)' }
    ];
  };

  // Auto-set fencing type based on sport
  useEffect(() => {
    const sportFencingDefaults = {
      'football': 'garnware',
      'boxcricket': 'garnware',
      'badminton': 'aluminium'
    };

    const updatedRequirements = { ...courtRequirements };
    let hasChanges = false;

    for (const courtKey in updatedRequirements) {
      const court = updatedRequirements[courtKey];
      const defaultFencing = sportFencingDefaults[court.sport];
      
      if (defaultFencing && !court.fencing.type) {
        updatedRequirements[courtKey] = {
          ...court,
          fencing: {
            ...court.fencing,
            type: defaultFencing
          }
        };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setCourtRequirements(updatedRequirements);
    }
  }, [courtRequirements]);

  if (!projectInfo.sports || projectInfo.sports.length === 0) {
    return (
      <div className="form-container">
        <h2>Construction Requirements</h2>
        <p>No sports selected. Please go back and select at least one sport.</p>
        <button type="button" onClick={prevStep} className="btn-secondary">
          Back to Sports Selection
        </button>
      </div>
    );
  }

  return (
    <div className="form-container">
      <h2>Construction Requirements</h2>
      <form onSubmit={handleSubmit}>
        {Object.keys(courtRequirements).map(courtKey => {
          const court = courtRequirements[courtKey];
          const sportConfig = projectInfo.sports.find(s => s.sport === court.sport);
          
          return (
            <div key={courtKey} className="court-requirements-section">
              <div className="court-header">
                <h3>
                  {court.sport.replace(/-/g, ' ').toUpperCase()} - Court {court.courtNumber}
                  {sportConfig?.quantity > 1 && ` of ${sportConfig.quantity}`}
                </h3>
              </div>

              {/* Subbase Section */}
              <div className="section">
                <h4>Subbase Construction</h4>
                <div className="form-group">
                  <label>Subbase Type:</label>
                  <select
                    value={court.subbase.type}
                    onChange={(e) => handleCourtChange(courtKey, 'subbase', 'type', e.target.value)}
                    required
                  >
                    <option value="">Select Subbase Type</option>
                    <option value="concrete">Concrete Base</option>
                    <option value="asphalt">Asphalt Base</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={court.subbase.edgewall}
                      onChange={(e) => handleCourtChange(courtKey, 'subbase', 'edgewall', e.target.checked)}
                    />
                    Include Edgewall
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={court.subbase.drainage.required}
                      onChange={(e) => handleCourtDrainageChange(courtKey, 'required', e.target.checked)}
                    />
                    Include Drainage System (Automatic slope calculation)
                  </label>
                </div>
              </div>

              {/* Flooring Section */}
              <div className="section">
                <h4>Flooring</h4>
                <div className="form-group">
                  <label>Flooring Type:</label>
                  <select
                    value={court.flooring.type}
                    onChange={(e) => handleCourtChange(courtKey, 'flooring', 'type', e.target.value)}
                    required
                  >
                    <option value="">Select Flooring Type</option>
                    {getFlooringOptions(court.sport).map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fencing Section */}
              <div className="section">
                <h4>Fencing</h4>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={court.fencing.required}
                      onChange={(e) => handleCourtChange(courtKey, 'fencing', 'required', e.target.checked)}
                    />
                    Include Fencing
                  </label>
                </div>
                
                {court.fencing.required && (
                  <>
                    <div className="form-group">
                      <label>Fencing Type:</label>
                      <select
                        value={court.fencing.type}
                        onChange={(e) => handleCourtChange(courtKey, 'fencing', 'type', e.target.value)}
                        required
                      >
                        <option value="">Select Fencing Type</option>
                        {getFencingOptions(court.sport).map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Equipment Section */}
              <div className="section">
                <h4>Sports Equipment</h4>
                {court.equipment && court.equipment.length > 0 ? (
                  court.equipment.map((item, index) => (
                    <div key={index} className="equipment-item">
                      <div className="equipment-info">
                        <strong>{item.name}</strong>
                        <span>Unit Cost: ₹{(Number(item.unitCost) || 0).toLocaleString()}</span>
                      </div>
                      <div className="form-group">
                        <label>Quantity:</label>
                        <input
                          type="number"
                          value={Number(item.quantity) || ''}
                          onChange={(e) => handleEquipmentChange(courtKey, index, 'quantity', e.target.value)}
                          min="1"
                          required
                        />
                      </div>
                      <div className="equipment-total">
                        Total: ₹{(Number(item.totalCost) || 0).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No equipment available for this sport.</p>
                )}
              </div>

              {/* Lighting Section */}
              <div className="section">
                <h4>Lighting</h4>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={court.lighting.required}
                      onChange={(e) => handleCourtChange(courtKey, 'lighting', 'required', e.target.checked)}
                    />
                    Include Lighting System
                  </label>
                </div>
                
                {court.lighting.required && (
                  <>
                    <div className="form-group">
                      <label>Lighting Type:</label>
                      <select
                        value={court.lighting.type}
                        onChange={(e) => handleCourtChange(courtKey, 'lighting', 'type', e.target.value)}
                        required
                      >
                        <option value="">Select Lighting Type</option>
                        {getLightingOptions(court.sport).map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Lights per Pole:</label>
                      <select
                        value={court.lighting.lightsPerPole}
                        onChange={(e) => handleCourtChange(courtKey, 'lighting', 'lightsPerPole', parseInt(e.target.value))}
                      >
                        <option value={2}>2 Lights per pole</option>
                        <option value={3}>3 Lights per pole</option>
                        <option value={4}>4 Lights per pole</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              
              <hr className="court-divider" />
            </div>
          );
        })}

        <div className="button-group">
          <button type="button" onClick={prevStep} className="btn-secondary">
            Back
          </button>
          <button 
            type="submit" 
            className="btn-primary"
          >
            Generate Quotation
          </button>
        </div>
      </form>
    </div>
  );
};

export default Requirements;