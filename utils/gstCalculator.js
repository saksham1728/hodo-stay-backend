/**
 * GST Calculator Utility
 * Calculates GST based on per-night pricing
 * 
 * GST Rules:
 * - Per night price <= 7500: 5% GST
 * - Per night price > 7500: 18% GST
 * 
 * GST is calculated on the final price (after coupon discount if applied)
 */

const GST_THRESHOLD = 7500;
const GST_RATE_LOW = 0.05;  // 5%
const GST_RATE_HIGH = 0.18; // 18%

/**
 * Calculate GST for a booking
 * @param {number} totalPrice - Total price before GST (after coupon if applied)
 * @param {number} nights - Number of nights
 * @returns {Object} GST calculation details
 */
function calculateGST(totalPrice, nights) {
  // Validate inputs
  if (!totalPrice || totalPrice <= 0) {
    throw new Error('Total price must be greater than zero');
  }
  
  if (!nights || nights <= 0) {
    throw new Error('Number of nights must be greater than zero');
  }

  // Calculate per night price
  const pricePerNight = totalPrice / nights;

  // Determine GST rate based on per night price
  const gstRate = pricePerNight <= GST_THRESHOLD ? GST_RATE_LOW : GST_RATE_HIGH;
  const gstPercentage = gstRate * 100;

  // Calculate GST amount
  const gstAmount = Math.round(totalPrice * gstRate * 100) / 100;

  // Calculate final price with GST
  const finalPriceWithGST = Math.round((totalPrice + gstAmount) * 100) / 100;

  return {
    priceBeforeGST: Math.round(totalPrice * 100) / 100,
    pricePerNight: Math.round(pricePerNight * 100) / 100,
    gstRate: gstPercentage,
    gstAmount: gstAmount,
    finalPrice: finalPriceWithGST,
    breakdown: {
      basePrice: Math.round(totalPrice * 100) / 100,
      gst: gstAmount,
      total: finalPriceWithGST
    }
  };
}

/**
 * Validate GST calculation from client
 * This ensures clients cannot bypass GST by manipulating frontend calculations
 * @param {number} clientTotal - Total amount sent by client
 * @param {number} expectedBasePrice - Expected base price (after coupon)
 * @param {number} nights - Number of nights
 * @returns {Object} Validation result
 */
function validateGSTCalculation(clientTotal, expectedBasePrice, nights) {
  const serverCalculation = calculateGST(expectedBasePrice, nights);
  
  // Allow 1 rupee tolerance for rounding differences
  const tolerance = 1;
  const difference = Math.abs(clientTotal - serverCalculation.finalPrice);
  
  if (difference > tolerance) {
    return {
      valid: false,
      error: 'Price mismatch detected. Please refresh and try again.',
      expected: serverCalculation.finalPrice,
      received: clientTotal,
      difference: difference
    };
  }

  return {
    valid: true,
    calculation: serverCalculation
  };
}

/**
 * Get GST details for display purposes
 * @param {number} totalPrice - Total price before GST
 * @param {number} nights - Number of nights
 * @returns {Object} GST details for display
 */
function getGSTDetails(totalPrice, nights) {
  try {
    const calculation = calculateGST(totalPrice, nights);
    return {
      success: true,
      data: calculation
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  calculateGST,
  validateGSTCalculation,
  getGSTDetails,
  GST_THRESHOLD,
  GST_RATE_LOW,
  GST_RATE_HIGH
};
