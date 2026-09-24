const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PORT = '0';

const { app, users, resetUsers } = require('../server.js');

const originalUsers = users.slice();

function restoreUsers() {
  resetUsers(originalUsers);
}

test('register API should create buyer with inactive/unverified account flags', async () => {
  restoreUsers();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Buyer',
        email: 'buyer@example.com',
        password: 'Abcdef12',
        confirmPassword: 'Abcdef12',
      }),
    });

    const data = await response.json();

    assert.equal(response.status, 201);
    assert.equal(data.success, true);
    assert.equal(data.user.role, 'buyer');
    assert.equal(data.user.is_active, false);
    assert.equal(data.user.is_verified, false);
    assert.notEqual(data.user.password_hash, 'Abcdef12');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    restoreUsers();
  }
});

test('register API should reject duplicate email addresses', async () => {
  restoreUsers();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Buyer',
        email: 'duplicate@example.com',
        password: 'Abcdef12',
        confirmPassword: 'Abcdef12',
      }),
    });

    const duplicateResponse = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Another Buyer',
        email: 'duplicate@example.com',
        password: 'Abcdef12',
        confirmPassword: 'Abcdef12',
      }),
    });

    const data = await duplicateResponse.json();
    assert.equal(duplicateResponse.status, 409);
    assert.equal(data.success, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    restoreUsers();
  }
});

test('register API should reject invalid input data', async () => {
  restoreUsers();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'A',
        email: 'bad-email',
        password: 'short',
        confirmPassword: 'different',
      }),
    });

    const data = await response.json();
    assert.equal(response.status, 400);
    assert.equal(data.success, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    restoreUsers();
  }
});

test('login API should accept valid credentials and return success', async () => {
  restoreUsers();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Login User',
        email: 'login@example.com',
        password: 'Abcdef12',
        confirmPassword: 'Abcdef12',
      }),
    });

    const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login@example.com',
        password: 'Abcdef12',
      }),
    });

    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.success, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    restoreUsers();
  }
});
