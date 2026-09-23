const { authorize } = require('../middleware/roleMiddleware');
const routeRegistry = require('../middleware/routeRegistry');
const express = require('express');
const request = require('supertest');

// --- Unit tests for authorize middleware ---
describe('authorize middleware', () => {
  it('should return 403 if req.user is missing', () => {
    const middleware = authorize('admin');
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 403 if user does not have required role', () => {
    const middleware = authorize('admin');
    const req = { user: { roles: ['buyer'] } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should call next if user has required role', () => {
    const middleware = authorize('admin', 'organizer');
    const req = { user: { roles: ['organizer'] } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// --- Integration tests for route registry ---
jest.mock('../middleware/authMiddleware', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    if (req.headers.authorization === 'Bearer valid') {
      req.user = { roles: ['admin'] };
      next();
    } else if (req.headers.authorization === 'Bearer buyer') {
      req.user = { roles: ['buyer'] };
      next();
    } else {
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  })
}));

const app = express();
app.use(routeRegistry.enforceRoutePermissions);
app.get('/api/events', (req, res) => res.sendStatus(200));
app.post('/api/events', (req, res) => res.sendStatus(201));
app.get('/unregistered', (req, res) => res.sendStatus(200));

describe('enforceRoutePermissions', () => {
  it('allows public routes', async () => {
    const res = await request(app).get('/api/events');
    expect(res.statusCode).toBe(200);
  });

  it('denies unregistered routes by default', async () => {
    const res = await request(app).get('/unregistered');
    expect(res.statusCode).toBe(403);
  });

  it('requires authentication for protected routes', async () => {
    const res = await request(app).post('/api/events');
    expect(res.statusCode).toBe(401);
  });

  it('denies access if authenticated but lacking role', async () => {
    const res = await request(app).post('/api/events').set('Authorization', 'Bearer buyer');
    expect(res.statusCode).toBe(403);
  });

  it('allows access if authenticated and has correct role', async () => {
    const res = await request(app).post('/api/events').set('Authorization', 'Bearer valid');
    expect(res.statusCode).toBe(201);
  });
});
