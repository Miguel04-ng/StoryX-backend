require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const { serveUploads } = require('./middleware/upload');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const {
  authRouter, profilesRouter, bookingsRouter, messagesRouter,
  reviewsRouter, postsRouter, favoritesRouter,
  paymentsRouter, subscriptionsRouter, adminRouter,
} = require('./routes/index');

const app = express();
serveUploads(app);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'verif-hash'],
}));

app.use('/api', rateLimit({ windowMs: 15*60*1000, max: 1000,
  message: { success: false, message: 'Trop de requêtes.' } }));
app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 20,
  message: { success: false, message: 'Trop de tentatives.' } }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.get('/api/health', async (req, res) => {
  let dbStatus = 'ok';
  try { const { sequelize } = require('./config/db'); await sequelize.authenticate(); }
  catch { dbStatus = 'error'; }
  res.status(dbStatus === 'ok' ? 200 : 503).json({
    success: dbStatus === 'ok', version: '3.0.0', database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth',          authRouter);
app.use('/api/profiles',      profilesRouter);
app.use('/api/bookings',      bookingsRouter);
app.use('/api/messages',      messagesRouter);
app.use('/api/reviews',       reviewsRouter);
app.use('/api/posts',         postsRouter);
app.use('/api/favorites',     favoritesRouter);
app.use('/api/payments',      paymentsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/admin',         adminRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
