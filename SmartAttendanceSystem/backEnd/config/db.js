const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    ''
  ).trim();

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing in backEnd/.env');
  }

  try {
    console.log('Connecting to MongoDB...');

    const conn = await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB_NAME || 'SmartAttendanceDB',
      serverSelectionTimeoutMS: 30000,
    });

    console.log('MongoDB Connected Successfully!');
    console.log('Database:', conn.connection.name);

    return conn;
  } catch (error) {
    console.error('MongoDB Connection Error:', error.name);
    console.error('Message:', error.message);
    throw error;
  }
};

module.exports = connectDB;