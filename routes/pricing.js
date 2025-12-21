const express = require('express');
const router = express.Router();
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

// Get live pricing and availability for a unit
router.get('/units/:unitId/quote', async (req, res) => {
    try {
        const { unitId } = req.params;
        const { checkIn, checkOut, guests } = req.query;

        // Validate required parameters
        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                error: 'checkIn and checkOut dates are required'
            });
        }

        // Get unit from database to get Rentals United Property ID
        const Unit = require('../models/Unit');
        const unit = await Unit.findById(unitId);

        if (!unit) {
            return res.status(404).json({
                success: false,
                error: 'Unit not found'
            });
        }

        // Format dates for Rentals United API (YYYY-MM-DD)
        const dateFrom = new Date(checkIn).toISOString().split('T')[0];
        const dateTo = new Date(checkOut).toISOString().split('T')[0];

        // Validate guest count against unit capacity (use standardGuests as max)
        let numberOfGuests = guests ? parseInt(guests) : unit.standardGuests || 1;
        if (numberOfGuests > unit.standardGuests) {
            numberOfGuests = unit.standardGuests;
        }
        if (numberOfGuests < 1) {
            numberOfGuests = 1;
        }

        console.log(`Getting price quote for unit ${unitId} (RU Property ID: ${unit.ruPropertyId}) from ${dateFrom} to ${dateTo} for ${numberOfGuests} guests (max: ${unit.standardGuests})`);

        // Call Rentals United API for pricing and availability using the correct RU Property ID
        const xmlResponse = await ruClient.pullGetPropertyAvbPrice(
            unit.ruPropertyId, // Use Rentals United Property ID, not MongoDB ID
            dateFrom,
            dateTo,
            numberOfGuests,
            'USD'
        );

        // Parse XML response
        const parsedResponse = xmlParser.parse(xmlResponse);
        console.log('Parsed pricing response:', JSON.stringify(parsedResponse, null, 2));

        // Extract pricing and availability data
        const pullResponse = parsedResponse.Pull_GetPropertyAvbPrice_RS;

        // Log the specific property structure
        if (pullResponse && pullResponse.Property) {
            console.log('Property structure:', JSON.stringify(pullResponse.Property, null, 2));
        }

        if (!pullResponse) {
            return res.status(404).json({
                success: false,
                error: 'Invalid response from pricing service',
                details: 'No response data'
            });
        }

        // Check if there's an error status
        if (pullResponse.Status && typeof pullResponse.Status === 'string' && pullResponse.Status !== 'Success') {
            return res.status(400).json({
                success: false,
                error: 'Property not available for selected dates',
                details: pullResponse.Status
            });
        }

        // Extract pricing from the correct Rentals United structure
        const propertyPrices = pullResponse.PropertyPrices || {};
        const reservationBreakdown = pullResponse.ReservationsBreakdowns?.ReservationBreakdown?.RUBreakdown || {};
        const dayPricesArray = reservationBreakdown.DayPrices || [];

        // Calculate total and per-night pricing
        const totalPrice = parseFloat(reservationBreakdown.Total || propertyPrices.PropertyPrice || 0);
        const nights = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
        const pricePerNight = nights > 0 ? totalPrice / nights : 0;

        console.log('Extracted pricing:', {
            totalPrice,
            pricePerNight,
            nights,
            dayPricesArray: dayPricesArray.length
        });

        // Log full response to check for tax fields
        console.log('Full RU Response for tax analysis:', JSON.stringify(pullResponse, null, 2));

        const priceInfo = {
            unitId: unitId,
            ruPropertyId: unit.ruPropertyId,
            available: true,
            checkIn: dateFrom,
            checkOut: dateTo,
            nights: Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)),
            guests: numberOfGuests || unit.standardGuests || 1,
            pricing: {
                totalPrice: totalPrice,
                pricePerNight: pricePerNight,
                currency: 'USD', // Prices from Rentals United are in USD
                breakdown: {
                    basePrice: pricePerNight,
                    taxes: 0, // No tax calculation for now
                    fees: 0
                }
            },
            propertyDetails: {
                name: unit.name,
                maxGuests: unit.standardGuests || 1,
                standardGuests: unit.standardGuests || 1,
                checkInOut: unit.checkInOut
            },
            // Include raw data for debugging
            rawData: {
                propertyPrices: propertyPrices,
                breakdown: reservationBreakdown,
                dayPrices: dayPricesArray
            }
        };

        res.json({
            success: true,
            data: {
                quote: priceInfo
            }
        });

    } catch (error) {
        console.error('Error getting price quote:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get price quote',
            details: error.message
        });
    }
});

// Get availability calendar for a unit (30 days from today)
router.get('/units/:unitId/availability', async (req, res) => {
    try {
        const { unitId } = req.params;
        const { month, year } = req.query;

        // Get unit from database to get Rentals United Property ID
        const Unit = require('../models/Unit');
        const unit = await Unit.findById(unitId);

        if (!unit) {
            return res.status(404).json({
                success: false,
                error: 'Unit not found'
            });
        }

        // Default to next month if not specified (to avoid past dates)
        const targetDate = new Date();
        if (month && year) {
            targetDate.setMonth(parseInt(month) - 1); // Month is 0-indexed
            targetDate.setFullYear(parseInt(year));
        } else {
            // Default to next month to avoid past dates
            targetDate.setMonth(targetDate.getMonth() + 1);
        }

        // Get first and last day of the month, but ensure we don't go into the past
        const today = new Date();
        const firstDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const lastDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

        // If the first day is in the past, start from today
        if (firstDay < today) {
            firstDay.setTime(today.getTime());
        }

        const dateFrom = firstDay.toISOString().split('T')[0];
        const dateTo = lastDay.toISOString().split('T')[0];

        console.log(`Getting availability for unit ${unitId} (RU Property ID: ${unit.ruPropertyId}) for ${dateFrom} to ${dateTo}`);

        // Call Rentals United API using the correct RU Property ID
        const xmlResponse = await ruClient.pullGetPropertyAvbPrice(
            unit.ruPropertyId, // Use Rentals United Property ID, not MongoDB ID
            dateFrom,
            dateTo,
            null, // No specific guest count for availability check
            'USD'
        );

        // Parse XML response
        const parsedResponse = xmlParser.parse(xmlResponse);
        const pullResponse = parsedResponse.Pull_GetPropertyAvbPrice_RS;

        if (!pullResponse || pullResponse.Status !== 'Success') {
            return res.status(404).json({
                success: false,
                error: 'Unable to get availability',
                details: pullResponse?.Errors || 'Unknown error'
            });
        }

        // For now, return basic availability info
        // In a full implementation, you'd parse daily availability from the response
        const availabilityInfo = {
            unitId: unitId,
            month: targetDate.getMonth() + 1,
            year: targetDate.getFullYear(),
            available: pullResponse.Status === 'Success',
            minStay: pullResponse.Property?.MinStay || 1,
            maxStay: pullResponse.Property?.MaxStay || 30
        };

        res.json({
            success: true,
            data: {
                availability: availabilityInfo
            }
        });

    } catch (error) {
        console.error('Error getting availability:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get availability',
            details: error.message
        });
    }
});

module.exports = router;