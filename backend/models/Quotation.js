const mongoose = require('mongoose');

const sportSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  quantity: { type: Number, default: 1 }
});

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 }
});

// New schema for individual court requirements
const courtRequirementSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  courtNumber: { type: Number, required: true },
  area: { type: Number, default: 0 },
  perimeter: { type: Number, default: 0 },
  subbase: {
    type: { type: String },
    edgewall: { type: Boolean, default: false },
    drainage: { 
      required: { type: Boolean, default: false },
      slope: { type: Number, default: 0 }
    }
  },
  fencing: {
    required: { type: Boolean, default: false },
    type: { type: String },
    length: { type: Number }
  },
  flooring: {
    type: { type: String }
  },
  equipment: [equipmentSchema],
  lighting: {
    required: { type: Boolean, default: false },
    type: { type: String, default: 'standard' },
    poles: { type: Number, default: 0 },
    lightsPerPole: { type: Number, default: 2 }
  }
});

const quotationSchema = new mongoose.Schema({
  clientInfo: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    purpose: { type: String, required: true }
  },
  
  projectInfo: {
    constructionType: { type: String, required: true },
    unit: { type: String, default: 'meters' },
    length: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    area: { type: Number, default: 0 },
    perimeter: { type: Number, default: 0 },
    sports: [sportSchema]
  },
  
  requirements: {
    // Keep existing structure for backward compatibility
    subbase: {
      type: { type: String },
      edgewall: { type: Boolean, default: false },
      drainage: { 
        required: { type: Boolean, default: false },
        slope: { type: Number, default: 0 }
      }
    },
    fencing: {
      required: { type: Boolean, default: false },
      type: { type: String },
      length: { type: Number }
    },
    flooring: {
      type: { type: String }
    },
    equipment: [equipmentSchema],
    lighting: {
      required: { type: Boolean, default: false },
      type: { type: String, default: 'standard' },
      poles: { type: Number, default: 0 },
      lightsPerPole: { type: Number, default: 2 }
    },
    // Add courtRequirements for multiple courts
    courtRequirements: {
      type: Map,
      of: courtRequirementSchema,
      default: {}
    }
  },
  
  pricing: {
    subbaseCost: { type: Number, default: 0 },
    edgewallCost: { type: Number, default: 0 },
    drainageCost: { type: Number, default: 0 },
    fencingCost: { type: Number, default: 0 },
    flooringCost: { type: Number, default: 0 },
    equipmentCost: { type: Number, default: 0 },
    lightingCost: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 }
  },
  
  quotationNumber: { type: String, unique: true },
  status: { type: String, default: 'pending' },
  adminNotes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Calculate dimensions before saving
quotationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (!this.quotationNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.quotationNumber = `NXR${timestamp}${random}`;
  }
  
  // Calculate area and perimeter for project info
  let area = this.projectInfo.length * this.projectInfo.width;
  let perimeter = 2 * (this.projectInfo.length + this.projectInfo.width);
  
  // Convert to meters if input was in feet
  if (this.projectInfo.unit === 'feet') {
    area = area * 0.092903; // sq feet to sq meters
    perimeter = perimeter * 0.3048; // feet to meters
  }
  
  this.projectInfo.area = Math.round(area * 100) / 100;
  this.projectInfo.perimeter = Math.round(perimeter * 100) / 100;
  
  // Calculate individual court dimensions if courtRequirements exist
  if (this.requirements.courtRequirements) {
    const courtRequirementsMap = this.requirements.courtRequirements;
    
    courtRequirementsMap.forEach((court, courtKey) => {
      // If court has its own length/width, calculate area and perimeter
      if (court.length && court.width) {
        let courtArea = court.length * court.width;
        let courtPerimeter = 2 * (court.length + court.width);
        
        // Convert to meters if input was in feet
        if (this.projectInfo.unit === 'feet') {
          courtArea = courtArea * 0.092903;
          courtPerimeter = courtPerimeter * 0.3048;
        }
        
        court.area = Math.round(courtArea * 100) / 100;
        court.perimeter = Math.round(courtPerimeter * 100) / 100;
      } else {
        // Use project-level dimensions as fallback
        court.area = this.projectInfo.area;
        court.perimeter = this.projectInfo.perimeter;
      }
    });
  }
  
  next();
});

// Helper method to get all court requirements as array
quotationSchema.methods.getCourtRequirementsArray = function() {
  if (!this.requirements.courtRequirements) {
    return [];
  }
  return Array.from(this.requirements.courtRequirements.values());
};

// Helper method to add a court requirement
quotationSchema.methods.addCourtRequirement = function(courtKey, courtData) {
  if (!this.requirements.courtRequirements) {
    this.requirements.courtRequirements = new Map();
  }
  this.requirements.courtRequirements.set(courtKey, courtData);
};

module.exports = mongoose.model('Quotation', quotationSchema);