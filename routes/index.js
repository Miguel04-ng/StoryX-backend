const express = require('express');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');
const {
  validate, registerRules, loginRules,
  messageRules, reviewRules, paymentInitiateRules,
} = require('../middleware/validators');

const { register, login, getMe } = require('../controllers/authController');
const { getProfiles, getProfileById, upsertProfile, getMyProfile, getProfileStats } = require('../controllers/profileController');
const {
  sendMessage, replyMessage, getConversations, getConversationMessages, getUnreadCount,
  createReview, getProviderReviews,
  getTarifs, initiatePayment, handleWebhook, verifyPayment, getPaymentHistory,
} = require('../controllers/mainController');
const {
  createBooking, getBookings, updateBookingStatus,
  handleBookingWebhook, getPayouts, markPayoutPaid,
} = require('../controllers/bookingController');
const {
  createPost, getPosts, getMyPosts, deletePost,
  toggleFavorite, getFavorites, checkFavorite,
  incrementPostView,
} = require('../controllers/socialController');
const {
  getStats, getUsers, toggleUserActive, deleteUser,
  verifyPrestataire, approveReview, getAllPayments,
  getPendingPrestataires, admitPrestataire,
} = require('../controllers/adminController');

// ── Auth ──────────────────────────────────────────────────────────────────────
const authRouter = express.Router();
authRouter.post('/register', registerRules, validate, register);
authRouter.post('/login',    loginRules,    validate, login);
authRouter.get('/me',        protect, getMe);

// ── Profiles ──────────────────────────────────────────────────────────────────
const profilesRouter = express.Router();
profilesRouter.get('/',       optionalAuth, getProfiles);
profilesRouter.get('/mine',   protect, restrictTo('PRESTATAIRE'), getMyProfile);
profilesRouter.get('/stats',  protect, restrictTo('PRESTATAIRE'), getProfileStats);
profilesRouter.get('/:id',    optionalAuth, getProfileById);
profilesRouter.post('/',      protect, restrictTo('PRESTATAIRE'), upsertProfile);
profilesRouter.put('/:id',    protect, restrictTo('PRESTATAIRE'), upsertProfile);

// ── Bookings ──────────────────────────────────────────────────────────────────
const bookingsRouter = express.Router();
// Webhook sans JWT (appelé par CinetPay/Flutterwave)
bookingsRouter.post('/webhook/:provider',
  express.raw({ type: '*/*' }),
  (req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
      try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
    }
    next();
  },
  handleBookingWebhook
);
bookingsRouter.use(protect);
bookingsRouter.post('/',              restrictTo('CLIENT'), createBooking);
bookingsRouter.get('/',               getBookings);
bookingsRouter.patch('/:id/status',   updateBookingStatus);
// Admin : reversements
bookingsRouter.get('/payouts',              restrictTo('ADMIN'), getPayouts);
bookingsRouter.patch('/payouts/:id/pay',    restrictTo('ADMIN'), markPayoutPaid);

// ── Messages ──────────────────────────────────────────────────────────────────
const messagesRouter = express.Router();
messagesRouter.use(protect);
messagesRouter.post('/',                           restrictTo('CLIENT'), messageRules, validate, sendMessage);
messagesRouter.post('/reply',                      replyMessage);
messagesRouter.get('/',                            getConversations);
messagesRouter.get('/unread/count',                getUnreadCount);
messagesRouter.get('/conversation/:conversationId', getConversationMessages);

// ── Reviews ───────────────────────────────────────────────────────────────────
const reviewsRouter = express.Router();
reviewsRouter.post('/',                protect, restrictTo('CLIENT'), reviewRules, validate, createReview);
reviewsRouter.get('/:prestataireId',   optionalAuth, getProviderReviews);

// ── Posts (Publications prestataires) ─────────────────────────────────────────
const postsRouter = express.Router();
postsRouter.get('/',         optionalAuth, getPosts);
postsRouter.get('/mine',     protect, restrictTo('PRESTATAIRE'), getMyPosts);
postsRouter.post('/',        protect, restrictTo('PRESTATAIRE'), createPost);
postsRouter.delete('/:id',   protect, deletePost);
postsRouter.post('/:id/view', optionalAuth, incrementPostView); // J'utilse optionalAuth au lieu de authMilddleware pour que même les visiteurs non connectés puissent compter une vue.

// ── Favorites ─────────────────────────────────────────────────────────────────
const favoritesRouter = express.Router();
favoritesRouter.use(protect);
favoritesRouter.get('/',                            getFavorites);
favoritesRouter.post('/toggle',                     toggleFavorite);
favoritesRouter.get('/check/:prestataireId',        checkFavorite);

// ── Payments (abonnements premium) ────────────────────────────────────────────
const paymentsRouter = express.Router();
paymentsRouter.post(
  '/webhook/:provider',
  express.raw({ type: '*/*' }),
  (req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
      try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
    }
    next();
  },
  handleWebhook
);
paymentsRouter.get('/tarifs',            protect, getTarifs);
paymentsRouter.post('/initiate',         protect, paymentInitiateRules, validate, initiatePayment);
paymentsRouter.get('/history',           protect, getPaymentHistory);
paymentsRouter.get('/verify/:reference', protect, verifyPayment);

// ── Subscriptions ─────────────────────────────────────────────────────────────
const subscriptionsRouter = express.Router();
subscriptionsRouter.use(protect);
subscriptionsRouter.get('/status', async (req, res, next) => {
  try {
    const { getPremiumStatus } = require('../services/premiumService');
    const status = await getPremiumStatus(req.user.id, req.isPremium);
    return res.json({ success: true, message: 'Statut Premium.', status });
  } catch (e) { next(e); }
});
subscriptionsRouter.get('/history', async (req, res, next) => {
  try {
    const { Subscription } = require('../models/index');
    const subs = await Subscription.findAll({ where: { user_id: req.user.id }, order: [['created_at','DESC']], limit: 20 });
    return res.json({ success: true, message: 'Historique.', subscriptions: subs });
  } catch (e) { next(e); }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(protect, restrictTo('ADMIN'));
adminRouter.get('/stats',                     getStats);
adminRouter.get('/users',                     getUsers);
adminRouter.patch('/users/:id/toggle',        toggleUserActive);
adminRouter.delete('/users/:id',              deleteUser);
adminRouter.get('/prestataires/pending',      getPendingPrestataires);
adminRouter.patch('/prestataires/:id/admit',  admitPrestataire);
adminRouter.patch('/prestataires/:id/verify', verifyPrestataire);
adminRouter.patch('/reviews/:id/approve',     approveReview);
adminRouter.get('/payments',                  getAllPayments);

module.exports = {
  authRouter, profilesRouter, bookingsRouter, messagesRouter,
  reviewsRouter, postsRouter, favoritesRouter,
  paymentsRouter, subscriptionsRouter, adminRouter,
};
