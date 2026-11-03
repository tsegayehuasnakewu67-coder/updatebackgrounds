// Smart Attendance MongoDB Playground
// Connection: localhost:27017

use('smart_attendance');

// Show database collections.
console.log('Collections:');
console.log(db.getCollectionNames());

// Show all registered users, including admin and employees.
console.log('Users:');
console.log(db.users.find({}, {
  fullName: 1,
  employeeId: 1,
  email: 1,
  department: 1,
  position: 1,
  role: 1,
  isActive: 1,
}).sort({ createdAt: -1 }).toArray());

// Show attendance records with the newest records first.
console.log('Attendance records:');
console.log(db.attendances.find({}).sort({ createdAt: -1 }).limit(50).toArray());

// Show shift configuration.
console.log('Shift settings:');
console.log(db.shiftsettings.find({}).toArray());
