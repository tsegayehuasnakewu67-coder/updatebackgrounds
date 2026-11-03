require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGODB_URI;

async function resetPassword() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected');

    // 👇 የሚፈልጉትን email እና አዲስ password ያስተካክሉ
    const email = 'yedenk@gmail.com';
    const newPassword = 'Yedenk@123';

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // 1. ያለውን user ያግኙ
    const user = await collection.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      console.log('\n📋 Available emails:');
      const all = await collection.find({}).project({ email: 1, fullName: 1, role: 1 }).toArray();
      all.forEach(u => console.log(`  - ${u.email} | ${u.fullName} | ${u.role}`));
      process.exit(1);
    }

    console.log('✅ Found user:', user.fullName);

    // 2. አዲስ hash ፍጠር
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. በቀጥታ ወደ database ጻፍ
    const result = await collection.updateOne(
      { email: email },
      {
        $set: {
          password: hashedPassword,
          isActive: true,
          status: 'Active',
          updatedAt: new Date()
        }
      }
    );

    console.log('\n✅ Password updated!');
    console.log('📧 Email:', email);
    console.log('🔑 New Password:', newPassword);
    console.log('Modified:', result.modifiedCount);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

resetPassword();