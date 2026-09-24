const crypto = require('crypto');
const db = require('../db');
const COOKIE_NAME = 'event_session';
function hash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function cookie(header = '') { return Object.fromEntries(header.split(';').map((v) => v.trim().split('=')).filter((v) => v.length === 2)); }
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 86400000);
  await db('user_sessions').insert({ user_id: userId, token_hash: hash(token), expires_at: expiresAt });
  return { token, expiresAt };
}
async function destroySession(req) {
  const token = cookie(req.headers.cookie)[COOKIE_NAME];
  if (token) await db('user_sessions').where({ token_hash: hash(token) }).del();
}
function setSessionCookie(res, session) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Expires=${session.expiresAt.toUTCString()}${secure}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
async function currentUser(req) {
  const token = cookie(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  const user = await db('user_sessions as s').join('users as u', 'u.id', 's.user_id').where('s.token_hash', hash(token)).where('s.expires_at', '>', db.fn.now()).where('u.is_active', true).first(['u.id', 'u.email']);
  if (!user) return null;
  user.roles = await db('roles').join('user_roles', 'roles.id', 'user_roles.role_id').where('user_roles.user_id', user.id).pluck('roles.name');
  return user;
}
module.exports = { COOKIE_NAME, createSession, destroySession, setSessionCookie, clearSessionCookie, currentUser };
