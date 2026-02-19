/**
 * Helper functions for working with the Property Content Schema
 */

/**
 * Transform building data for API response
 * Ensures consistent format and handles legacy fields
 */
function formatPropertyForAPI(building) {
  if (!building) return null;

  return {
    id: building._id,
    slug: building.slug,
    title: building.title || building.name,
    subTitle: building.subTitle,
    description: building.description,
    
    // Location - use new structure, fallback to legacy
    location: building.location?.city ? building.location : {
      addressLine1: building.legacyLocation?.address || '',
      city: building.legacyLocation?.city || '',
      state: building.legacyLocation?.state || '',
      country: building.legacyLocation?.country || '',
      pincode: building.legacyLocation?.zipCode || '',
      latitude: building.legacyLocation?.coordinates?.latitude,
      longitude: building.legacyLocation?.coordinates?.longitude
    },
    
    // Media
    heroImage: building.heroImage || building.images?.find(img => img.isPrimary)?.url,
    gallery: building.gallery?.length > 0 ? building.gallery : 
      building.images?.map((img, idx) => ({
        id: `img-${idx}`,
        url: img.url,
        altText: img.caption,
        type: 'other',
        order: idx
      })) || [],
    
    highlights: building.highlights || [],
    
    // Amenities - use new structure, fallback to legacy
    amenities: building.amenities?.length > 0 ? building.amenities :
      building.legacyAmenities?.map((name, idx) => ({
        id: `amenity-${idx}`,
        name,
        category: 'general'
      })) || [],
    
    accessibility: building.accessibility || [],
    policies: building.policies || [],
    reviewSummary: building.reviewSummary || [],
    reviews: building.reviews || [],
    roomTypes: building.roomTypes || [],
    
    seo: building.seo || {
      metaTitle: building.title || building.name,
      metaDescription: building.description || ''
    },
    
    // Metadata
    isActive: building.isActive,
    totalUnits: building.totalUnits,
    createdAt: building.createdAt,
    updatedAt: building.updatedAt
  };
}

/**
 * Get property SEO metadata
 */
function getPropertySEO(building) {
  if (!building) return null;

  const seo = building.seo || {};
  
  return {
    title: seo.metaTitle || building.title || building.name,
    description: seo.metaDescription || building.description || '',
    keywords: seo.keywords || [],
    ogImage: seo.ogImage || building.heroImage || building.images?.[0]?.url,
    canonicalUrl: seo.canonicalUrl || `/properties/${building.slug || building._id}`
  };
}

/**
 * Get amenities grouped by category
 */
function getAmenitiesByCategory(building) {
  if (!building || !building.amenities) return {};

  const grouped = {};
  
  building.amenities.forEach(amenity => {
    const category = amenity.category || 'general';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(amenity);
  });

  return grouped;
}

/**
 * Get nearby places grouped by type
 */
function getNearbyPlacesByType(building) {
  if (!building || !building.accessibility?.[0]?.nearbyPlaces) return {};

  const grouped = {};
  const places = building.accessibility[0].nearbyPlaces;
  
  places.forEach(place => {
    const type = place.type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(place);
  });

  return grouped;
}

/**
 * Get policy by type
 */
function getPolicy(building, policyType) {
  if (!building || !building.policies?.[0]) return null;
  
  const policies = building.policies[0];
  return policies[policyType] || null;
}

/**
 * Calculate average rating from reviews
 */
function calculateAverageRating(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return (sum / reviews.length).toFixed(1);
}

/**
 * Get rating breakdown from reviews
 */
function getRatingBreakdown(reviews) {
  if (!reviews || reviews.length === 0) {
    return {
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0
    };
  }

  const breakdown = {
    fiveStar: 0,
    fourStar: 0,
    threeStar: 0,
    twoStar: 0,
    oneStar: 0
  };

  reviews.forEach(review => {
    if (review.rating === 5) breakdown.fiveStar++;
    else if (review.rating === 4) breakdown.fourStar++;
    else if (review.rating === 3) breakdown.threeStar++;
    else if (review.rating === 2) breakdown.twoStar++;
    else if (review.rating === 1) breakdown.oneStar++;
  });

  return breakdown;
}

/**
 * Generate property breadcrumbs for SEO
 */
function generateBreadcrumbs(building) {
  if (!building) return [];

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Properties', url: '/properties' }
  ];

  if (building.location?.city) {
    breadcrumbs.push({
      name: building.location.city,
      url: `/properties?city=${building.location.city}`
    });
  }

  breadcrumbs.push({
    name: building.title || building.name,
    url: `/properties/${building.slug || building._id}`
  });

  return breadcrumbs;
}

/**
 * Check if property has complete content
 */
function hasCompleteContent(building) {
  if (!building) return false;

  return !!(
    building.slug &&
    building.title &&
    building.description &&
    building.location?.city &&
    building.heroImage &&
    building.gallery?.length > 0 &&
    building.amenities?.length > 0 &&
    building.policies?.length > 0 &&
    building.seo?.metaTitle
  );
}

/**
 * Get property highlights for search/listing
 */
function getPropertyHighlights(building) {
  if (!building) return [];

  const highlights = [];

  // Add location
  if (building.location?.city) {
    highlights.push(`📍 ${building.location.city}`);
  }

  // Add room types count
  if (building.roomTypes?.length > 0) {
    highlights.push(`🏠 ${building.roomTypes.length} Room Types`);
  }

  // Add amenities count
  if (building.amenities?.length > 0) {
    highlights.push(`✨ ${building.amenities.length}+ Amenities`);
  }

  // Add rating
  if (building.reviewSummary?.[0]?.averageRating) {
    highlights.push(`⭐ ${building.reviewSummary[0].averageRating}/5`);
  }

  // Add custom highlights
  if (building.highlights?.length > 0) {
    highlights.push(...building.highlights.slice(0, 3));
  }

  return highlights;
}

module.exports = {
  formatPropertyForAPI,
  getPropertySEO,
  getAmenitiesByCategory,
  getNearbyPlacesByType,
  getPolicy,
  calculateAverageRating,
  getRatingBreakdown,
  generateBreadcrumbs,
  hasCompleteContent,
  getPropertyHighlights
};
