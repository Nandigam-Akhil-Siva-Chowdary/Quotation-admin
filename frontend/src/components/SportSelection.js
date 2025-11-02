import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SportSelection = ({ data, updateData, nextStep, prevStep }) => {
  const [selectedSports, setSelectedSports] = useState(data.sports || []);
  const [sportsConfig, setSportsConfig] = useState([]);

  useEffect(() => {
    const fetchSportsConfig = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/quotations/sports-config');
        setSportsConfig(response.data.sports);
      } catch (error) {
        console.error('Error fetching sports config:', error);
      }
    };
    fetchSportsConfig();
  }, []);

  const handleSportToggle = (sport) => {
    setSelectedSports(prev => {
      const isSelected = prev.find(s => s.sport === sport.id);
      if (isSelected) {
        return prev.filter(s => s.sport !== sport.id);
      } else {
        return [...prev, { sport: sport.id, quantity: 1 }];
      }
    });
  };

  const handleQuantityChange = (sportId, quantity) => {
    setSelectedSports(prev =>
      prev.map(s => s.sport === sportId ? { ...s, quantity: parseInt(quantity) || 1 } : s)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedSports.length === 0) {
      alert('Please select at least one sport');
      return;
    }
    updateData({
      ...data,
      sports: selectedSports
    });
    nextStep();
  };

  const getStandardSize = (sportId) => {
    const sizes = {
      'basketball': '28m × 15m',
      'badminton': '13.4m × 6.1m',
      'boxcricket': '30m × 25m',
      'football': '105m × 68m',
      'tennis': '23.77m × 8.23m',
      'volleyball': '18m × 9m',
      'pickleball': '13.4m × 6.1m'
    };
    return sizes[sportId] || 'Custom';
  };

  return (
    <div className="form-container">
      <h2>Select Sports</h2>
      <form onSubmit={handleSubmit}>
        <div className="section">
          <h3>Choose Sports Courts</h3>
          <p className="info-text">You can select multiple sports</p>
          
          <div className="sports-selection-grid">
            {sportsConfig.map(sport => {
              const isSelected = selectedSports.find(s => s.sport === sport.id);
              const selectedData = isSelected ? selectedSports.find(s => s.sport === sport.id) : null;
              
              return (
                <div
                  key={sport.id}
                  className={`sport-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSportToggle(sport)}
                >
                  <div className="sport-header">
                    <div className="sport-icon">{sport.image}</div>
                    <div className="sport-info">
                      <div className="sport-name">{sport.name}</div>
                      <div className="sport-size">Standard: {getStandardSize(sport.id)}</div>
                    </div>
                    <div className="selection-indicator">
                      {isSelected ? '✓' : '+'}
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="sport-quantity">
                      <label>Number of Courts:</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={selectedData.quantity}
                        onChange={(e) => handleQuantityChange(sport.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="selected-sports-summary">
          <h4>Selected Sports ({selectedSports.length})</h4>
          {selectedSports.length > 0 ? (
            <div className="selected-list">
              {selectedSports.map(sport => {
                const sportConfig = sportsConfig.find(s => s.id === sport.sport);
                return (
                  <div key={sport.sport} className="selected-sport-item">
                    <span>{sportConfig?.name} ({sport.quantity} court{sport.quantity > 1 ? 's' : ''})</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>No sports selected</p>
          )}
        </div>

        <div className="button-group">
          <button type="button" onClick={prevStep} className="btn-secondary">
            Back
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={selectedSports.length === 0}
          >
            Next: Requirements
          </button>
        </div>
      </form>
    </div>
  );
};

export default SportSelection;