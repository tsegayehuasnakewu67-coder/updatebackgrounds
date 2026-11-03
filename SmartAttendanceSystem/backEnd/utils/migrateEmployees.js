const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const syncEmployeeForUser = require('./employeeSync').syncEmployeeForUser;

const migrateEmployees = async () => {
  const collections = await mongoose.connection.db.listCollections({ name: 'attendances' }).toArray();
  if (collections.length) {
    const attendanceCollection = mongoose.connection.collection('attendances');
    const indexes = await attendanceCollection.indexes();
    const legacyUserIndex = indexes.find((index) =>
      index.name === 'userId_1_date_1' && index.unique,
    );
    if (legacyUserIndex) {
      await attendanceCollection.dropIndex(legacyUserIndex.name);
    }

    const employeeDateIndex = indexes.find((index) => index.name === 'employeeId_1_date_1');
    if (employeeDateIndex && !employeeDateIndex.unique) {
      const duplicates = await attendanceCollection.aggregate([
        { $group: { _id: { employeeId: '$employeeId', date: '$date' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
      ]).toArray();
      if (duplicates.length) {
        throw new Error('Duplicate attendance employee/date records must be resolved before creating the unique index.');
      }
      await attendanceCollection.dropIndex(employeeDateIndex.name);
    }
  }

  await Promise.all([Employee.init(), Attendance.init()]);

  const users = User.find({ role: { $ne: 'admin' }, employeeId: { $exists: true, $ne: '' } }).cursor();
  for await (const user of users) {
    await syncEmployeeForUser(user);
  }

  const records = Attendance.find({ userId: { $ne: null }, employee: null }).cursor();
  for await (const record of records) {
    const user = await User.findById(record.userId).select('employeeRef');
    if (user?.employeeRef) {
      record.employee = user.employeeRef;
      await record.save();
    }
  }
};

module.exports = migrateEmployees;
