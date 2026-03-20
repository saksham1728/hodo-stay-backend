const mongoose = require('mongoose');
const Building = require('../models/Building');
require('dotenv').config();

async function createJPNagarBuilding() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if JP Nagar building already exists
    const existing = await Building.findOne({ slug: 'hodo-stays-jp-nagar' });
    if (existing) {
      console.log('JP Nagar building already exists:', existing._id);
      console.log('Slug:', existing.slug);
      return existing;
    }

    // Create new JP Nagar building
    const jpNagarBuilding = new Building({
      slug: 'hodo-stays-jp-nagar',
      name: 'Hodo Stays JP Nagar',
      title: 'Hodo Stays JP Nagar',
      subTitle: 'Modern Serviced Apartments in JP Nagar',
      description: 'Welcome to Hodo Stays JP Nagar, located in the heart of JP Nagar, Bangalore. Our modern apartments are perfect for both business and leisure travellers. Enjoy high-speed WiFi, TV, AC, a fully equipped kitchen, and daily housekeeping.',
      
      location: {
        addressLine1: 'JP Nagar',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        pincode: '560078',
        latitude: 12.9073812,
        longitude: 77.6417597
      },
      
      legacyLocation: {
        address: 'JP Nagar, Bangalore',
        city: 'Bangalore',
        state: 'Karnataka',
        zipCode: '560078',
        country: 'India',
        coordinates: {
          latitude: 12.9073812,
          longitude: 77.6417597
        }
      },
      
      heroImage: 'https://dwe6atvmvow8k.cloudfront.net/ru/725503/3894210/638679719866879578.jpg',
      
      highlights: [
        'High-speed WiFi',
        'Fully equipped kitchen',
        'Daily housekeeping',
        'AC in all rooms',
        'Smart TV',
        'Lift access',
        'Ground-level parking',
        'Rooftop community area'
      ],
      
      amenities: [
        { id: 'wifi', name: 'High-Speed WiFi', icon: 'wifi', category: 'general' },
        { id: 'ac', name: 'Air Conditioning', icon: 'ac', category: 'general' },
        { id: 'tv', name: 'Smart TV', icon: 'tv', category: 'entertainment' },
        { id: 'kitchen', name: 'Fully Equipped Kitchen', icon: 'kitchen', category: 'kitchen' },
        { id: 'parking', name: 'Free Parking', icon: 'parking', category: 'parking' },
        { id: 'housekeeping', name: 'Daily Housekeeping', icon: 'cleaning', category: 'general' }
      ],
      
      seo: {
        metaTitle: 'Hodo Stays JP Nagar - Modern Serviced Apartments in Bangalore',
        metaDescription: 'Book your stay at Hodo Stays JP Nagar. Modern serviced apartments with high-speed WiFi, fully equipped kitchen, and daily housekeeping.',
        keywords: ['serviced apartments jp nagar', 'hodo stays', 'bangalore accommodation', 'jp nagar hotels']
      },
      
      isActive: true,
      totalUnits: 9
    });

    await jpNagarBuilding.save();
    console.log('\n✅ JP Nagar building created successfully!');
    console.log('Building ID:', jpNagarBuilding._id);
    console.log('Slug:', jpNagarBuilding.slug);
    
    return jpNagarBuilding;

  } catch (error) {
    console.error('Error creating JP Nagar building:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  createJPNagarBuilding()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = createJPNagarBuilding;
