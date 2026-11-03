const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const ensureAdmin = require('./utils/adminSeed');

const main = async () => {
  try {
    await connectDB();
    await require('./models/User').init();
    await ensureAdmin();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

main();
