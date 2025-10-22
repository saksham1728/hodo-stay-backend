// Central export file for all models
const Property = require('./Property');
const User = require('./User');
const Booking = require('./Booking');
const AvailabilityCalendar = require('./AvailabilityCalendar');
const SyncLog = require('./SyncLog');

module.exports = {
  Property,
  User,
  Booking,
  AvailabilityCalendar,
  SyncLog
};