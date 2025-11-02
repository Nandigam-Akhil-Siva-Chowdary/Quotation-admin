import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SportSelection.css';

const SportSelection = ({ data, updateData, nextStep, prevStep }) => {
  const [selectedSports, setSelectedSports] = useState(data.sports || []);
  const [sportsConfig, setSportsConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSportsConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🔍 Fetching sports config from API...');
        
        const response = await axios.get('http://localhost:5000/api/sports-config');
        
        console.log('✅ API Response received:', response.data);
        
        // Handle the response structure
        let sportsData = [];
        
        if (response.data && response.data.sports) {
          sportsData = response.data.sports;
        } else if (Array.isArray(response.data)) {
          sportsData = response.data;
        } else {
          // Use fallback if structure is unexpected
          sportsData = getFallbackSports();
        }

        console.log('🎯 Loaded sports:', sportsData);
        setSportsConfig(sportsData);
        
      } catch (error) {
        console.error('❌ Error fetching sports config:', error);
        setError('Failed to load sports data. Using demo data.');
        setSportsConfig(getFallbackSports());
      } finally {
        setLoading(false);
      }
    };

    fetchSportsConfig();
  }, []);

  // Fallback sports data
  const getFallbackSports = () => {
    return [
      { 
        id: 'basketball', 
        name: 'Basketball', 
        image: '🏀',
        category: 'outdoor',
        description: 'Professional basketball court'
      },
      { 
        id: 'badminton', 
        name: 'Badminton', 
        image: '🏸',
        category: 'indoor',
        description: 'Standard badminton court'
      },
      { 
        id: 'boxcricket', 
        name: 'Box Cricket', 
        image: '🏏',
        category: 'outdoor',
        description: 'Indoor cricket facility'
      },
      { 
        id: 'football', 
        name: 'Football', 
        image: '⚽',
        category: 'outdoor',
        description: 'Professional football field'
      },
      { 
        id: 'tennis', 
        name: 'Tennis', 
        image: '🎾',
        category: 'outdoor',
        description: 'Standard tennis court'
      },
      { 
        id: 'volleyball', 
        name: 'Volleyball', 
        image: '🏐',
        category: 'outdoor',
        description: 'Beach and indoor volleyball'
      },
      { 
        id: 'pickleball', 
        name: 'Pickleball', 
        image: '🥒',
        category: 'outdoor',
        description: 'Modern paddle sport'
      }
    ];
  };

  const handleSportToggle = (sport) => {
    setSelectedSports(prev => {
      const isSelected = prev.find(s => s.sport === sport.id);
      if (isSelected) {
        return prev.filter(s => s.sport !== sport.id);
      } else {
        return [...prev, { 
          sport: sport.id, 
          quantity: 1, 
          sportName: sport.name 
        }];
      }
    });
  };

  const handleQuantityChange = (sportId, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1);
    
    setSelectedSports(prev =>
      prev.map(s => s.sport === sportId ? { ...s, quantity: qty } : s)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (selectedSports.length === 0) {
      alert('Please select at least one sport');
      return;
    }
    
    // Update both sports and the full projectInfo
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

  if (loading) {
    return (
      <div className="form-container">
        <h2>Select Sports Courts</h2>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading sports configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <h2>Select Sports Courts</h2>
      
      {error && (
        <div className="warning-banner">
          <span>⚠️ {error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="section">
          <h3>Choose Your Sports Facilities</h3>
          <p className="info-text">Select one or more sports and specify the number of courts for each</p>

          {/* Sports Selection Grid */}
          <div className="sports-selection-grid">
            {sportsConfig.map((sport) => {
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
                      <div className="sport-description">{sport.description}</div>
                    </div>
                    <div className="selection-indicator">
                      {isSelected ? '✓' : '+'}
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="sport-quantity" onClick={(e) => e.stopPropagation()}>
                      <label>Number of Courts:</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={selectedData?.quantity || 1}
                        onChange={(e) => handleQuantityChange(sport.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Sports Summary */}
        {selectedSports.length > 0 && (
          <div className="selected-sports-summary">
            <h4>Your Selected Sports ({selectedSports.length})</h4>
            <div className="selected-list">
              {selectedSports.map(sport => {
                const sportConfig = sportsConfig.find(s => s.id === sport.sport);
                return (
                  <div key={sport.sport} className="selected-sport-item">
                    <span className="sport-name">{sportConfig?.name || sport.sport}</span>
                    <span className="sport-quantity-badge">
                      {sport.quantity} court{sport.quantity > 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="button-group">
          <button type="button" onClick={prevStep} className="btn-secondary">
            ← Back
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={selectedSports.length === 0}
          >
            Next: Requirements →
          </button>
        </div>
      </form>
    </div>
  );
};

export default SportSelection;