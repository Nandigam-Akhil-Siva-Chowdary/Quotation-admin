import React, { useState } from 'react';
import './App.css';
import ClientInfo from './components/ClientInfo';
import ConstructionType from './components/ConstructionType';
import SportSelection from './components/SportSelection';
import Requirements from './components/Requirements';
import QuotationSummary from './components/QuotationSummary';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [formData, setFormData] = useState({
    clientInfo: {},
    projectInfo: {},
    requirements: {}
  });

  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);

  const updateFormData = (field, data) => {
    setFormData(prev => ({
      ...prev,
      [field]: data
    }));
  };

  const handleAdminLoginClick = () => {
    setShowAdminLogin(true);
  };

  const handleAdminLoginSuccess = () => {
    setShowAdminLogin(false);
    setIsAdmin(true);
  };

  const handleAdminBack = () => {
    setShowAdminLogin(false);
    setIsAdmin(false);
  };

  const handleUserFlow = () => {
    setIsAdmin(false);
    setShowAdminLogin(false);
    setCurrentStep(1);
  };

  // Render Admin Login if showAdminLogin is true
  if (showAdminLogin) {
    return <AdminLogin onSuccess={handleAdminLoginSuccess} onBack={handleAdminBack} />;
  }

  // Render Admin Dashboard if isAdmin is true
  if (isAdmin) {
    return <AdminDashboard onBack={handleUserFlow} />;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ClientInfo
            data={formData.clientInfo}
            updateData={(data) => updateFormData('clientInfo', data)}
            nextStep={nextStep}
            onAdminLogin={handleAdminLoginClick}
          />
        );
      case 2:
        return (
          <ConstructionType
            data={formData.projectInfo}
            updateData={(data) => updateFormData('projectInfo', data)}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        );
      case 3:
        return (
          <SportSelection
            data={formData.projectInfo}
            updateData={(data) => updateFormData('projectInfo', data)}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        );
      case 4:
        return (
          <Requirements
            data={formData.requirements}
            updateData={(data) => updateFormData('requirements', data)}
            nextStep={nextStep}
            prevStep={prevStep}
            projectInfo={formData.projectInfo}
          />
        );
      case 5:
        return (
          <QuotationSummary
            formData={formData}
            prevStep={prevStep}
            updateData={updateFormData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="company-header">
          <h1>NEXORA GROUP</h1>
          <p>Sports Infrastructure Solutions</p>
        </div>
        {!isAdmin && currentStep <= 4 && (
          <>
            <h2>Sports Ground Construction Quotation</h2>
            <div className="progress-bar">
              <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>Client Info</div>
              <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>Construction Type</div>
              <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>Sports Selection</div>
              <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>Requirements</div>
              <div className={`step ${currentStep >= 5 ? 'active' : ''}`}>Summary</div>
            </div>
          </>
        )}
      </header>
      <main>
        {renderStep()}
      </main>
      <footer className="app-footer">
        <div className="footer-content">
          <h3>NEXORA GROUP</h3>
          <p>Jalahalli West, Bangalore 560015</p>
          <p>📞 +91 8431322728 | 📧 info.nexoragroup@gmail.com</p>
          <p>www.nexoragroup.com</p>
        </div>
      </footer>
    </div>
  );
}

export default App;