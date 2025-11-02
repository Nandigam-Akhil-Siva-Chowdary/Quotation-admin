import React, { useState } from 'react';
import '../App.css';

const ClientInfo = ({ data, updateData, nextStep, onAdminLogin }) => {
  const [formData, setFormData] = useState({
    name: data.name || '',
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    purpose: data.purpose || ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.purpose) {
      alert('Please fill all required fields');
      return;
    }
    updateData(formData);
    nextStep();
  };

  return (
    <div className="form-container">
      <div className="admin-access">
        <button onClick={onAdminLogin} className="btn-admin">
          Admin Login
        </button>
      </div>

      <h2>Client Information</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter your full name"
          />
        </div>

        <div className="form-group">
          <label>Email Address *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label>Phone Number *</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            placeholder="Enter your phone number"
          />
        </div>

        <div className="form-group">
          <label>Address</label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter your complete address"
            rows="3"
          />
        </div>

        <div className="form-group">
          <label>Purpose of Construction *</label>
          <select
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            required
          >
            <option value="">Select Purpose</option>
            <option value="business">Business/Commercial</option>
            <option value="institution">Educational Institution</option>
            <option value="personal">Personal Use</option>
            <option value="apartment">Apartment Complex</option>
            <option value="school">School</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button type="submit" className="btn-primary">
          Next: Construction Type
        </button>
      </form>
    </div>
  );
};

export default ClientInfo;