const { Unit } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class UnitController {
  // Get unit details with full information from MongoDB (NO RU API calls)
  async getUnitDetails(req, res) {
    try {
      const { unitId } = req.params;
      
      console.log(`Fetching unit details for: ${unitId}`);
      
      // Find unit by MongoDB ID or RU Property ID
      let query = {};
      if (unitId.match(/^[0-9a-fA-F]{24}$/)) {
        query = { $or: [{ _id: unitId }, { ruPropertyId: parseInt(unitId) }] };
      } else {
        query = { ruPropertyId: parseInt(unitId) };
      }
      
      const unit = await Unit.findOne(query).populate('buildingId', 'name').lean();
      
      if (!unit) {
        return res.status(404).json({
          success: false,
          message: 'Unit not found'
        });
      }
      
      console.log(`Using MongoDB data for unit: ${unit.ruPropertyId} (last synced: ${new Date(unit.lastSyncedAt).toLocaleString()})`);
      
      res.json({
        success: true,
        data: {
          unit
        }
      });
      
    } catch (error) {
      console.error('Error in getUnitDetails:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get unit availability and pricing for specific dates
  async getUnitAvailabilityPrice(req, res) {
    try {
      const { unitId } = req.params;
      const { dateFrom, dateTo, guests, currency = 'USD' } = req.query;
      
      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          message: 'dateFrom and dateTo are required'
        });
      }
      
      console.log(`Getting availability and price for unit: ${unitId}, dates: ${dateFrom} to ${dateTo}`);
      
      // Find unit
      let query = {};
      if (unitId.match(/^[0-9a-fA-F]{24}$/)) {
        query = { $or: [{ _id: unitId }, { ruPropertyId: parseInt(unitId) }] };
      } else {
        query = { ruPropertyId: parseInt(unitId) };
      }
      
      const unit = await Unit.findOne(query).lean();
      
      if (!unit) {
        return res.status(404).json({
          success: false,
          message: 'Unit not found'
        });
      }
      
      // Get availability and pricing from Rentals United API
      try {
        const xmlResponse = await ruClient.pullGetPropertyAvbPrice(
          unit.ruPropertyId, 
          dateFrom, 
          dateTo, 
          guests, 
          currency
        );
        const parsedResponse = xmlParser.parse(xmlResponse);
        
        if (parsedResponse.error) {
          return res.status(400).json({
            success: false,
            error: parsedResponse.error,
            message: 'Error fetching availability from Rentals United'
          });
        }
        
        const priceData = parsedResponse?.Pull_GetPropertyAvbPrice_RS?.PropertyPrices;
        
        if (!priceData) {
          return res.status(404).json({
            success: false,
            message: 'No availability or pricing found for the selected dates'
          });
        }
        
        res.json({
          success: true,
          data: {
            unit: {
              id: unit._id,
              name: unit.name,
              ruPropertyId: unit.ruPropertyId
            },
            availability: {
              dateFrom,
              dateTo,
              guests: guests || unit.standardGuests,
              currency,
              pricing: priceData,
              isAvailable: true
            }
          }
        });
        
      } catch (apiError) {
        console.error('Error fetching availability:', apiError);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch availability',
          error: apiError.message
        });
      }
      
    } catch (error) {
      console.error('Error in getUnitAvailabilityPrice:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

const unitController = new UnitController();
module.exports = unitController;