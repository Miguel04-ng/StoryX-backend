const jwt = require('jsonwebtoken');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendSuccess = (res, statusCode, message, data = {}) =>
  res.status(statusCode).json({ success: true, message, ...data });

const sendError = (res, statusCode, message, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 12));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages:  Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

// Génère une référence unique STX-{timestamp}-{random}
const generateReference = () => {
  const { v4: uuidv4 } = require('uuid');
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `STX-${ts}-${rand}`;
};

module.exports = {
  generateToken,
  sendSuccess,
  sendError,
  getPagination,
  buildPaginationMeta,
  generateReference,
};
