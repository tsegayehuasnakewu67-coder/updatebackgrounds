require('dotenv').config();
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGODB_URI;

async function copyUsersToEmployees() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected');

    const db = mongoose.connection.db;
    const usersCol = db.collection('users');
    const employeesCol = db.collection('employees');

    const userCount = await usersCol.countDocuments();
    console.log('Users count:', userCount);

    const empCount = await employeesCol.countDocuments();
    console.log('Employees count (before):', empCount);

    // ሁሉንም users ን ወደ employees ይቅዱ
    const allUsers = await usersCol.find({}).toArray();

    let added = 0;
    for (const u of allUsers) {
      const exists = await employeesCol.findOne({ email: u.email });
      if (exists) {
        console.log('SKIP (exists):', u.email);
        continue;
      }

      // አዲስ id ፍጠር
      const { _id, ...rest } = u;
      await employeesCol.insertOne({
        ...rest,
        status: u.isActive ? 'Active' : 'Inactive',
      });
      console.log('CREATED:', u.email, '| status:', u.isActive ? 'Active' : 'Inactive');
      added++;
    }

    const finalCount = await employeesCol.countDocuments();
    console.log('\n=== Summary ===');
    console.log('Added:', added);
    console.log('Total in employees:', finalCount);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

copyUsersToEmployees();