/**
 * Pricing Markup Utility
 * Applies platform markup to base prices from cache
 * 
 * SECURITY: This markup is applied on the backend only
 * Frontend receives already marked-up prices
 */

// Platform markup percentage (10%)
const MARKUP_PERCENTAGE = 10;

/**
 * Apply markup to a price
 * @param {number} basePrice - Base price from cache
 * @returns {number} Price with markup applied
 */
function applyMarkup(basePrice) {
  if (!basePrice || basePrice <= 0) {
    return 0;
  }
  
  const markup = basePrice * (MARKUP_PERCENTAGE / 100);
  const finalPrice = basePrice + markup;
  
  // Round to 2 decimal places
  const rounded = Math.round(finalPrice * 100) / 100;
  
  console.log(`   🔢 Markup Calculation: ₹${basePrice} + ${MARKUP_PERCENTAGE}% (₹${markup.toFixed(2)}) = ₹${rounded}`);
  
  return rounded;
}

/**
 * Calculate markup amount
 * @param {number} basePrice - Base price from cache
 * @returns {number} Markup amount
 */
function calculateMarkupAmount(basePrice) {
  if (!basePrice || basePrice <= 0) {
    return 0;
  }
  
  const markup = basePrice * (MARKUP_PERCENTAGE / 100);
  return Math.round(markup * 100) / 100;
}

/**
 * Get markup percentage
 * @returns {number} Markup percentage
 */
function getMarkupPercentage() {
  return MARKUP_PERCENTAGE;
}

/**
 * Apply markup to daily prices array
 * @param {Array} dailyPrices - Array of daily price objects
 * @returns {Array} Array with marked-up prices
 */
function applyMarkupToDailyPrices(dailyPrices) {
  return dailyPrices.map(day => ({
    ...day,
    basePrice: day.price,
    price: applyMarkup(day.price),
    markup: calculateMarkupAmount(day.price)
  }));
}

/**
 * Reverse calculate base price from marked-up price
 * Used for validation during payment
 * @param {number} markedUpPrice - Price with markup
 * @returns {number} Original base price
 */
function reverseMarkup(markedUpPrice) {
  if (!markedUpPrice || markedUpPrice <= 0) {
    return 0;
  }
  
  const basePrice = markedUpPrice / (1 + MARKUP_PERCENTAGE / 100);
  return Math.round(basePrice * 100) / 100;
}

module.exports = {
  applyMarkup,
  calculateMarkupAmount,
  getMarkupPercentage,
  applyMarkupToDailyPrices,
  reverseMarkup,
  MARKUP_PERCENTAGE
};
