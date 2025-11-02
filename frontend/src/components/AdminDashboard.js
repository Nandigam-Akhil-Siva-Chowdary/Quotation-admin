import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminDashboard = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({});
  const [quotations, setQuotations] = useState([]);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, [refreshTrigger]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        alert('Please login first');
        onBack();
        return;
      }

      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      const [statsRes, quotationsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/admin/dashboard', config),
        axios.get('http://localhost:5000/api/admin/quotations?limit=50', config)
      ]);

      setStats(statsRes.data);
      setQuotations(quotationsRes.data.quotations);
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('adminToken');
        alert('Session expired. Please login again.');
        onBack();
      }
    }
    setLoading(false);
  };

  const refreshData = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleApproveQuotation = async (quotationId, notes) => {
    try {
      const token = localStorage.getItem('adminToken');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      const response = await axios.post(
        `http://localhost:5000/api/admin/quotations/${quotationId}/approve`,
        { notes },
        config
      );
      
      // Enhanced success message with PDF status
      if (response.data.emailSent && response.data.pdfAttached) {
        alert(`✅ Quotation Approved Successfully!\n\n📧 PDF Quotation sent to: ${response.data.recipient}\n📄 Professional PDF with complete details attached\n\nThe client will receive a downloadable PDF quotation via email.`);
      } else if (response.data.emailSent) {
        alert(`✅ Quotation Approved!\n📧 Email sent to: ${response.data.recipient}\n⚠️ PDF attachment failed - please send manually`);
      } else {
        alert(`✅ Quotation Approved!\n❌ Email failed. Please contact: ${response.data.recipient}\nError: ${response.data.emailError || 'Unknown error'}`);
      }
      
      // Refresh data after approval
      refreshData();
      setSelectedQuotation(null);
    } catch (error) {
      console.error('Error approving quotation:', error);
      alert('❌ Error approving quotation. Please try again.');
    }
  };

  const handleRejectQuotation = async (quotationId, notes) => {
    try {
      const token = localStorage.getItem('adminToken');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      await axios.post(
        `http://localhost:5000/api/admin/quotations/${quotationId}/reject`,
        { notes },
        config
      );
      
      alert('❌ Quotation rejected successfully');
      refreshData();
      setSelectedQuotation(null);
    } catch (error) {
      console.error('Error rejecting quotation:', error);
      alert('Error rejecting quotation');
    }
  };

  if (loading) return <div className="loading">🔄 Loading Dashboard...</div>;

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="header-left">
          <h1>🏠 Admin Dashboard</h1>
          <button onClick={refreshData} className="btn-refresh" title="Refresh Data">
            🔄 Refresh
          </button>
        </div>
        <button onClick={onBack} className="btn-secondary">← Back to Main</button>
      </div>

      <div className="admin-nav">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={activeTab === 'quotations' ? 'active' : ''}
          onClick={() => setActiveTab('quotations')}
        >
          📋 All Quotations ({quotations.length})
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="dashboard-section">
          <div className="section-header">
            <h2>📈 Dashboard Overview</h2>
            <div className="last-updated">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="dashboard-stats">
            <div className="stat-card today">
              <h3>📅 Today's Quotations</h3>
              <div className="stat-number">{stats.quotationsToday || 0}</div>
              <div className="stat-trend">New today</div>
            </div>
            <div className="stat-card total">
              <h3>📊 Total Quotations</h3>
              <div className="stat-number">{stats.totalQuotations || 0}</div>
              <div className="stat-trend">All time</div>
            </div>
            <div className="stat-card pending">
              <h3>⏳ Pending Review</h3>
              <div className="stat-number">{stats.pendingQuotations || 0}</div>
              <div className="stat-trend">Awaiting action</div>
            </div>
            <div className="stat-card approved">
              <h3>✅ Approved</h3>
              <div className="stat-number">{stats.approvedQuotations || 0}</div>
              <div className="stat-trend">Completed</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <h3>🚀 Quick Actions</h3>
            <div className="action-buttons">
              <button onClick={refreshData} className="btn-primary">
                🔄 Refresh All Data
              </button>
              <button 
                onClick={() => setActiveTab('quotations')} 
                className="btn-secondary"
              >
                📋 View All Quotations
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quotations' && (
        <div className="quotations-section">
          <div className="section-header">
            <h2>📋 Quotation Management ({quotations.length})</h2>
            <div className="section-actions">
              <button onClick={refreshData} className="btn-refresh-small">
                🔄 Refresh
              </button>
              <div className="filter-group">
                <span>Filter by:</span>
                <select 
                  onChange={(e) => {
                    // You can implement filtering here
                    console.log('Filter:', e.target.value);
                  }} 
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {quotations.length === 0 ? (
            <div className="empty-state">
              <h3>📭 No Quotations Found</h3>
              <p>No quotation requests have been submitted yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Quote No.</th>
                    <th>Client Information</th>
                    <th>Project Details</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map(quote => (
                    <tr key={quote._id} className={`status-${quote.status}`}>
                      <td className="quote-number">
                        <strong>{quote.quotationNumber}</strong>
                        {quote.status === 'approved' && (
                          <span className="approved-badge">✅ Approved</span>
                        )}
                        {quote.status === 'rejected' && (
                          <span className="rejected-badge">❌ Rejected</span>
                        )}
                      </td>
                      <td className="client-info">
                        <div className="client-details">
                          <strong>{quote.clientInfo?.name}</strong>
                          <div className="client-contact">
                            <small>📧 {quote.clientInfo?.email}</small>
                            <small>📞 {quote.clientInfo?.phone}</small>
                          </div>
                          <small>🎯 {quote.clientInfo?.purpose}</small>
                        </div>
                      </td>
                      <td className="project-info">
                        <strong>
                          {quote.projectInfo?.sports?.map(s => s.sport).join(', ') || 
                           quote.projectInfo?.sport || 'Multi-Sport'}
                        </strong>
                        <div className="project-details">
                          <small>📏 {quote.projectInfo?.area || 0} m²</small>
                          <small>🏗️ {quote.projectInfo?.constructionType}</small>
                        </div>
                      </td>
                      <td className="price-cell">
                        <strong>₹{quote.pricing?.grandTotal?.toLocaleString() || '0'}</strong>
                      </td>
                      <td>
                        <span className={`status ${quote.status}`}>
                          {quote.status === 'approved' ? '✅ Approved' : 
                           quote.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                          {quote.status === 'approved' && quote.approvedAt && (
                            <small><br/>📅 {new Date(quote.approvedAt).toLocaleDateString()}</small>
                          )}
                        </span>
                      </td>
                      <td className="date-cell">
                        {new Date(quote.createdAt).toLocaleDateString()}
                        <br/>
                        <small>{new Date(quote.createdAt).toLocaleTimeString()}</small>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            onClick={() => setSelectedQuotation(quote)}
                            className="btn-view"
                            title="View Details"
                          >
                            👁️ View
                          </button>
                          {quote.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => setSelectedQuotation(quote)}
                                className="btn-approve"
                                title="Approve & Send PDF"
                              >
                                ✅ Approve
                              </button>
                              <button 
                                onClick={() => {
                                  if (window.confirm('Reject this quotation?')) {
                                    handleRejectQuotation(quote._id, 'Rejected after review');
                                  }
                                }}
                                className="btn-reject"
                                title="Reject Quotation"
                              >
                                ❌ Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedQuotation && (
        <QuotationModal 
          quotation={selectedQuotation}
          onClose={() => setSelectedQuotation(null)}
          onApprove={handleApproveQuotation}
          onReject={handleRejectQuotation}
          onRefresh={refreshData}
        />
      )}
    </div>
  );
};

const QuotationModal = ({ quotation, onClose, onApprove, onReject, onRefresh }) => {
  const [notes, setNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApproveClick = async () => {
    if (window.confirm('APPROVE this quotation?\n\n✅ Quotation will be marked as approved\n📧 PDF will be emailed to the client\n📄 Client will receive downloadable quotation')) {
      setApproving(true);
      await onApprove(quotation._id, notes);
      setApproving(false);
    }
  };

  const handleRejectClick = async () => {
    const rejectNotes = prompt('Please provide reason for rejection:', notes || 'Rejected after review');
    if (rejectNotes !== null) {
      setRejecting(true);
      await onReject(quotation._id, rejectNotes);
      setRejecting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <div className="modal-title">
            <h2>Quotation #{quotation.quotationNumber}</h2>
            <span className={`status-badge large ${quotation.status}`}>
              {quotation.status === 'approved' ? '✅ APPROVED' : 
               quotation.status === 'rejected' ? '❌ REJECTED' : '⏳ PENDING REVIEW'}
            </span>
          </div>
          <div className="modal-actions">
            <button onClick={onClose} className="btn-close" title="Close">×</button>
          </div>
        </div>
        
        <div className="modal-body">
          {/* Client Information */}
          <div className="info-section">
            <h3>👤 Client Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Full Name:</label>
                <span>{quotation.clientInfo?.name || 'N/A'}</span>
              </div>
              <div className="info-item">
                <label>Email:</label>
                <span>{quotation.clientInfo?.email || 'N/A'}</span>
              </div>
              <div className="info-item">
                <label>Phone:</label>
                <span>{quotation.clientInfo?.phone || 'N/A'}</span>
              </div>
              <div className="info-item">
                <label>Purpose:</label>
                <span>{quotation.clientInfo?.purpose || 'N/A'}</span>
              </div>
              <div className="info-item full-width">
                <label>Address:</label>
                <span>{quotation.clientInfo?.address || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="info-section">
            <h3>🏗️ Project Details</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Sport:</label>
                <span>
                  {quotation.projectInfo?.sports?.map(s => s.sport).join(', ') || 
                   quotation.projectInfo?.sport || 'N/A'}
                </span>
              </div>
              <div className="info-item">
                <label>Construction Type:</label>
                <span>{quotation.projectInfo?.constructionType || 'Standard'}</span>
              </div>
              <div className="info-item">
                <label>Area:</label>
                <span>{quotation.projectInfo?.area || 0} m²</span>
              </div>
              <div className="info-item">
                <label>Perimeter:</label>
                <span>{quotation.projectInfo?.perimeter || 0} m</span>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="info-section">
            <h3>⚙️ Requirements</h3>
            <div className="requirements-grid">
              <div className="requirement-item">
                <strong>Subbase:</strong> {quotation.requirements?.subbase?.type || 'Not specified'}
              </div>
              <div className="requirement-item">
                <strong>Flooring:</strong> {quotation.requirements?.flooring?.type || 'Not specified'}
              </div>
              <div className="requirement-item">
                <strong>Fencing:</strong> {quotation.requirements?.fencing?.required ? 'Yes' : 'No'} 
                {quotation.requirements?.fencing?.type && ` (${quotation.requirements.fencing.type})`}
              </div>
              <div className="requirement-item">
                <strong>Lighting:</strong> {quotation.requirements?.lighting?.required ? 'Yes' : 'No'}
                {quotation.requirements?.lighting?.type && ` (${quotation.requirements.lighting.type})`}
              </div>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="info-section">
            <h3>💰 Pricing Breakdown</h3>
            <div className="pricing-table">
              {quotation.pricing && Object.entries(quotation.pricing)
                .filter(([key, value]) => value > 0 && key !== 'subtotal' && key !== 'gstAmount' && key !== 'grandTotal')
                .map(([key, value]) => (
                  <div key={key} className="price-row">
                    <span className="price-description">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                    </span>
                    <span className="price-amount">₹{value?.toLocaleString() || 0}</span>
                  </div>
                ))
              }
              {quotation.pricing?.subtotal > 0 && (
                <>
                  <div className="price-row subtotal">
                    <span className="price-description"><strong>Subtotal:</strong></span>
                    <span className="price-amount"><strong>₹{quotation.pricing.subtotal?.toLocaleString()}</strong></span>
                  </div>
                  <div className="price-row">
                    <span className="price-description">GST @18%:</span>
                    <span className="price-amount">₹{quotation.pricing.gstAmount?.toLocaleString()}</span>
                  </div>
                  <div className="price-row grand-total">
                    <span className="price-description"><strong>GRAND TOTAL:</strong></span>
                    <span className="price-amount"><strong>₹{quotation.pricing.grandTotal?.toLocaleString()}</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Approval/Rejection Section */}
          {quotation.status === 'pending' && (
            <div className="action-section">
              <h3>🎯 Take Action</h3>
              <div className="form-group">
                <label>Notes for Client (Optional):</label>
                <textarea
                  placeholder="Add any special notes, instructions, or comments that will be included in the email and PDF..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="3"
                />
                <small>These notes will be included in the email and PDF quotation</small>
              </div>
              <div className="action-buttons-modal">
                <button 
                  onClick={handleApproveClick}
                  className="btn-approve-large"
                  disabled={approving}
                >
                  {approving ? '📧 Sending PDF...' : '✅ Approve & Send PDF via Email'}
                </button>
                <button 
                  onClick={handleRejectClick}
                  className="btn-reject-large"
                  disabled={rejecting}
                >
                  {rejecting ? 'Processing...' : '❌ Reject Quotation'}
                </button>
              </div>
              <div className="action-info">
                <p><strong>When you approve:</strong></p>
                <ul>
                  <li>✅ Quotation status changes to "Approved"</li>
                  <li>📧 Professional PDF quotation is generated</li>
                  <li>📄 PDF is emailed to {quotation.clientInfo?.email}</li>
                  <li>📋 Client receives downloadable quotation</li>
                  <li>📞 Our team will contact client within 24 hours</li>
                </ul>
              </div>
            </div>
          )}

          {/* Approved Info */}
          {quotation.status === 'approved' && (
            <div className="approved-info">
              <h3>✅ Approval Details</h3>
              <div className="approval-details">
                <p><strong>Approved by:</strong> {quotation.approvedBy || 'Admin'}</p>
                <p><strong>Approved on:</strong> {new Date(quotation.approvedAt).toLocaleString()}</p>
                {quotation.adminNotes && (
                  <p><strong>Admin Notes:</strong> {quotation.adminNotes}</p>
                )}
                <p><strong>PDF Status:</strong> ✅ Sent to client via email</p>
              </div>
            </div>
          )}

          {/* Rejected Info */}
          {quotation.status === 'rejected' && (
            <div className="rejected-info">
              <h3>❌ Rejection Details</h3>
              <div className="rejection-details">
                <p><strong>Rejected by:</strong> {quotation.rejectedBy || 'Admin'}</p>
                <p><strong>Rejected on:</strong> {new Date(quotation.rejectedAt).toLocaleString()}</p>
                {quotation.adminNotes && (
                  <p><strong>Reason:</strong> {quotation.adminNotes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;