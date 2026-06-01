const jwt = require('jsonwebtoken');

const generateAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });

const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET);

module.exports = { generateAccessToken, verifyAccessToken };
