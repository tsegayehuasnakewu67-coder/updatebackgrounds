const ShiftSettings = require('../models/ShiftSettings');
const { DEFAULT_SHIFT_SETTINGS } = require('../constants/shiftSettings');

const getShiftSettings = async () => {
  const settings = await ShiftSettings.findOneAndUpdate(
    { _key: 'default' },
    { $setOnInsert: DEFAULT_SHIFT_SETTINGS },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const saved = settings?.toObject ? settings.toObject() : settings;
  return { ...DEFAULT_SHIFT_SETTINGS, ...(saved || {}) };
};

module.exports = { getShiftSettings };