require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('../models/Building');

async function setBuildingImages() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // HSR Layout Images - Using placeholder images for now
    const hsrImages = [
      { id: 'hsr-img-001', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', altText: 'HSR Layout Building Exterior', type: 'exterior', order: 1 },
      { id: 'hsr-img-002', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', altText: 'HSR Layout Living Room', type: 'living', order: 2 },
      { id: 'hsr-img-003', url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', altText: 'HSR Layout Bedroom', type: 'bedroom', order: 3 },
      { id: 'hsr-img-004', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800', altText: 'HSR Layout Kitchen', type: 'kitchen', order: 4 },
      { id: 'hsr-img-005', url: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=800', altText: 'HSR Layout Common Area', type: 'common', order: 5 },
      { id: 'hsr-img-006', url: 'https://images.unsplash.com/photo-1556912167-f556f1f39faa?w=800', altText: 'HSR Layout Bathroom', type: 'bathroom', order: 6 },
      { id: 'hsr-img-007', url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800', altText: 'HSR Layout View', type: 'other', order: 7 },
      { id: 'hsr-img-008', url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800', altText: 'HSR Layout Interior', type: 'other', order: 8 }
    ];

    // JP Nagar Images - Different set of images
    const jpImages = [
      { id: 'jp-img-001', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800', altText: 'JP Nagar Building Exterior', type: 'exterior', order: 1 },
      { id: 'jp-img-002', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800', altText: 'JP Nagar Living Room', type: 'living', order: 2 },
      { id: 'jp-img-003', url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', altText: 'JP Nagar Bedroom', type: 'bedroom', order: 3 },
      { id: 'jp-img-004', url: 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=800', altText: 'JP Nagar Kitchen', type: 'kitchen', order: 4 },
      { id: 'jp-img-005', url: 'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800', altText: 'JP Nagar Common Area', type: 'common', order: 5 },
      { id: 'jp-img-006', url: 'https://images.unsplash.com/photo-1556912998-c57cc6b63cd7?w=800', altText: 'JP Nagar Bathroom', type: 'bathroom', order: 6 },
      { id: 'jp-img-007', url: 'https://images.unsplash.com/photo-1556909114-4727aa1f0b5f?w=800', altText: 'JP Nagar View', type: 'other', order: 7 },
      { id: 'jp-img-008', url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', altText: 'JP Nagar Interior', type: 'other', order: 8 }
    ];

    // Update HSR Layout
    const hsrBuilding = await Building.findOne({ name: 'Hodo Stays HSR Layout' });
    if (hsrBuilding) {
      await Building.updateOne(
        { _id: hsrBuilding._id },
        { $set: { images: hsrImages } }
      );
      console.log(`✅ Updated HSR Layout with ${hsrImages.length} images`);
    } else {
      console.log('❌ HSR Layout building not found');
    }

    // Update JP Nagar
    const jpBuilding = await Building.findOne({ name: 'Hodo Stays JP Nagar' });
    if (jpBuilding) {
      await Building.updateOne(
        { _id: jpBuilding._id },
        { $set: { images: jpImages } }
      );
      console.log(`✅ Updated JP Nagar with ${jpImages.length} images`);
    } else {
      console.log('❌ JP Nagar building not found');
    }

    console.log('\n✅ Building images updated successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

setBuildingImages();
