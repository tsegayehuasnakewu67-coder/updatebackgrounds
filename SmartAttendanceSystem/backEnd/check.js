const mongoose = require('mongoose');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BASE = 'http://localhost:5000';

function req(method, url, body) {
  return new Promise((resolve, reject) => {
    const data  = body ? JSON.stringify(body) : null;
    const opts  = {
      method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    };
    const u     = new URL(BASE + url);
    opts.hostname = u.hostname;
    opts.port     = u.port;
    opts.path     = u.pathname;
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: (() => { try { return JSON.parse(raw); } catch { return raw; } })() }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const OK  = (msg) => console.log('  ✅ ' + msg);
const ERR = (msg) => console.log('  ❌ ' + msg);
const INF = (msg) => console.log('     ' + msg);

(async () => {
  console.log('\n════════════════════════════════════════');
  console.log('  SMART ATTENDANCE SYSTEM — FULL CHECK ');
  console.log('════════════════════════════════════════\n');

  // ── 1. Backend ──────────────────────────────────
  console.log('[1] Backend Health');
  try {
    const h = await req('GET', '/api/health');
    if (h.status === 200) OK('Backend running on port 5000');
    else ERR('Backend responded with status ' + h.status);
  } catch {
    ERR('Backend NOT running — start: npm run dev');
    process.exit(1);
  }

  // ── 2. MongoDB ──────────────────────────────────
  console.log('\n[2] MongoDB Connection');
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'SmartAttendanceDB',
    });
    OK('Connected to ' + mongoose.connection.host);
  } catch {
    ERR('MongoDB FAILED. Check the MongoDB URI and database network access.');
    process.exit(1);
  }

  // ── 3. Users in DB ──────────────────────────────
  console.log('\n[3] Users in Database');
  const User = require('./models/User');
  const users = await User.find({}).select('fullName email role isActive faceDescriptor');
  OK('Total users: ' + users.length);
  if (users.length === 0) {
    INF('No users yet — signup to create first account');
  } else {
    users.forEach(u => {
      const face = u.faceDescriptor?.length === 128 ? 'face:YES' : 'face:NO';
      INF(`${u.fullName} | ${u.email} | ${u.role} | active:${u.isActive} | ${face}`);
    });
  }

  // ── 4. Public signup must remain disabled ───────
  console.log('\n[4] Public Signup API Test');
  const sr    = await req('POST', '/api/auth/signup', {
    fullName: 'Check User',
  });
  if (sr.status === 403) OK('Public signup is disabled as expected.');
  else ERR(`Expected public signup to be rejected (403); received ${sr.status}.`);

  // ── 5. Login remains available to provisioned users.
  console.log('\n[5] Login API');
  INF('Login test requires an existing account; no account was created by this diagnostic.');

  // ── 6. Attendance mark route ─────────────────────
  console.log('\n[6] Attendance Route Reachable');
  const ar = await req('POST', '/api/attendance/mark', { faceDescriptor: [] });
  if (ar.status === 400) OK('/api/attendance/mark reachable (400=invalid descriptor, expected)');
  else INF('Status: ' + ar.status + ' — ' + JSON.stringify(ar.body));

  // ── 7. Frontend files ────────────────────────────
  console.log('\n[7] Frontend Key Files');
  const frontBase = path.join(__dirname, '../frontEnd/src');
  const required  = [
    'pages/Login.jsx', 'pages/Signup.jsx', 'pages/MarkAttendance.jsx',
    'pages/admin/AdminDashboard.jsx', 'pages/admin/ManageUsers.jsx',
    'pages/admin/AttendanceReports.jsx', 'pages/user/UserDashboard.jsx',
    'context/AuthContext.jsx', 'services/api.js', 'utils/ .js',
  ];
  required.forEach(f => {
    const full = path.join(frontBase, f);
    if (fs.existsSync(full)) {
      const lines = fs.readFileSync(full, 'utf8').split('\n').length;
      OK(f + ' (' + lines + ' lines)');
    } else {
      ERR('MISSING: ' + f);
    }
  });

  // ── 8. Model files ───────────────────────────────
  console.log('\n[8] Face-API Model Files (/public/models)');
  const modelsDir = path.join(__dirname, '../frontEnd/public/models');
  const needed    = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
  ];
  needed.forEach(f => {
    const full = path.join(modelsDir, f);
    if (fs.existsSync(full)) {
      const kb = Math.round(fs.statSync(full).size / 1024);
      OK(f + ' (' + kb + ' KB)');
    } else {
      ERR('MISSING: ' + f);
    }
  });

  // ── 10. Cleanup test user ────────────────────────
  console.log('\n[10] Cleanup test user');
  await User.deleteOne({ email });
  OK('Test user removed from DB');

  await mongoose.disconnect();

  console.log('\n════════════════════════════════════════');
  console.log('  CHECK COMPLETE');
  console.log('════════════════════════════════════════\n');
  process.exit(0);
})();
