const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { getApiRateLimitKey, shouldSkipGlobalApiLimit } = require('../middleware/apiSecurity');

test('login requests use the dedicated login limiter rather than the shared API quota', () => {
  assert.equal(shouldSkipGlobalApiLimit({ method: 'POST', path: '/auth/login' }), true);
  assert.equal(shouldSkipGlobalApiLimit({ method: 'GET', path: '/auth/login' }), false);
  assert.equal(shouldSkipGlobalApiLimit({ method: 'POST', path: '/auth/forgot-password' }), false);
  assert.equal(shouldSkipGlobalApiLimit({ method: 'POST', path: '/contact' }), false);
});

test('face bulk registration retains its existing global-limit exemption', () => {
  assert.equal(shouldSkipGlobalApiLimit({ method: 'POST', path: '/face/bulk-register' }), true);
});

test('Admin contact inbox uses its dedicated limiter instead of consuming the shared API quota', () => {
  assert.equal(shouldSkipGlobalApiLimit({ method: 'GET', path: '/admin/messages' }), true);
  assert.equal(shouldSkipGlobalApiLimit({ method: 'PATCH', path: '/admin/messages/abc/read' }), true);
  assert.equal(shouldSkipGlobalApiLimit({ method: 'POST', path: '/admin/messages/abc/replies' }), true);
  assert.equal(shouldSkipGlobalApiLimit({ method: 'GET', path: '/admin/messages-extra' }), false);
  assert.equal(shouldSkipGlobalApiLimit({ method: 'GET', path: '/users' }), false);
});

test('verified authenticated requests use a per-account API rate-limit bucket', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-secret-with-sufficient-length';
  try {
    const firstToken = jwt.sign({ id: 'account-1' }, process.env.JWT_SECRET);
    const secondToken = jwt.sign({ id: 'account-2' }, process.env.JWT_SECRET);
    const request = token => ({
      headers: { authorization: `Bearer ${token}` },
      ip: '192.0.2.20',
    });

    assert.equal(getApiRateLimitKey(request(firstToken)), 'user:account-1');
    assert.equal(getApiRateLimitKey(request(secondToken)), 'user:account-2');
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('missing and invalid bearer tokens remain in the IPv6-safe IP rate-limit bucket', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-secret-with-sufficient-length';
  try {
    assert.equal(
      getApiRateLimitKey({ headers: {}, ip: '2001:db8::1' }),
      'ip:2001:db8::/56',
    );
    assert.equal(
      getApiRateLimitKey({ headers: { authorization: 'Bearer invalid-token' }, ip: '192.0.2.20' }),
      'ip:192.0.2.20',
    );
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
