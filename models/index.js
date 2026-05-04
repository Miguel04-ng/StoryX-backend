const { sequelize } = require('../config/db');

const User        = require('./User');
const Client      = require('./Client');
const Prestataire = require('./Prestataire');
const { Profile, Photo, Category, Admin, Notification, Setting } = require('./Misc');
const { Subscription, Booking, Payment, Conversation, Message, Review, AuditLog } = require('./Transactional');
const { Post, PostMedia, Favorite, PayoutRequest } = require('./Social');

// ── User → Client / Prestataire / Admin ──────────────────────────────────────
User.hasOne(Client,       { foreignKey: 'user_id', as: 'client',      onDelete: 'CASCADE' });
Client.belongsTo(User,    { foreignKey: 'user_id', as: 'user' });

User.hasOne(Prestataire,      { foreignKey: 'user_id', as: 'prestataire', onDelete: 'CASCADE' });
Prestataire.belongsTo(User,   { foreignKey: 'user_id', as: 'user' });

User.hasOne(Admin,   { foreignKey: 'user_id', as: 'admin', onDelete: 'CASCADE' });
Admin.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Prestataire → Profile → Photos ───────────────────────────────────────────
Prestataire.hasOne(Profile,    { foreignKey: 'prestataire_id', as: 'profile', onDelete: 'CASCADE' });
Profile.belongsTo(Prestataire, { foreignKey: 'prestataire_id', as: 'prestataire' });

Profile.hasMany(Photo,  { foreignKey: 'profile_id', as: 'photos', onDelete: 'CASCADE' });
Photo.belongsTo(Profile, { foreignKey: 'profile_id', as: 'profile' });

// ── Profile ↔ Category (M:N) ──────────────────────────────────────────────────
Profile.belongsToMany(Category, { through: 'profile_categories', foreignKey: 'profile_id', otherKey: 'category_id', as: 'profileCategories' });
Category.belongsToMany(Profile, { through: 'profile_categories', foreignKey: 'category_id', otherKey: 'profile_id', as: 'profiles' });

// ── Subscriptions ─────────────────────────────────────────────────────────────
User.hasMany(Subscription, { foreignKey: 'user_id', as: 'subscriptions', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Bookings ──────────────────────────────────────────────────────────────────
Client.hasMany(Booking,      { foreignKey: 'client_id',      as: 'bookings',       onDelete: 'RESTRICT' });
Booking.belongsTo(Client,    { foreignKey: 'client_id',      as: 'client' });
Prestataire.hasMany(Booking, { foreignKey: 'prestataire_id', as: 'bookings_reçus', onDelete: 'RESTRICT' });
Booking.belongsTo(Prestataire, { foreignKey: 'prestataire_id', as: 'prestataire' });

// ── Booking → PayoutRequest (1:1) ────────────────────────────────────────────
Booking.hasOne(PayoutRequest,      { foreignKey: 'booking_id', as: 'payout', onDelete: 'RESTRICT' });
PayoutRequest.belongsTo(Booking,   { foreignKey: 'booking_id', as: 'booking' });
PayoutRequest.belongsTo(Prestataire, { foreignKey: 'prestataire_id', as: 'prestataire' });
Prestataire.hasMany(PayoutRequest, { foreignKey: 'prestataire_id', as: 'payouts' });

// ── Payments ──────────────────────────────────────────────────────────────────
Booking.hasOne(Payment,      { foreignKey: 'booking_id',      as: 'payment', onDelete: 'SET NULL' });
Payment.belongsTo(Booking,   { foreignKey: 'booking_id',      as: 'booking' });
Subscription.hasOne(Payment, { foreignKey: 'subscription_id', as: 'payment', onDelete: 'SET NULL' });
Payment.belongsTo(Subscription, { foreignKey: 'subscription_id', as: 'subscription' });
User.hasMany(Payment,        { foreignKey: 'payer_user_id',   as: 'payments', onDelete: 'RESTRICT' });
Payment.belongsTo(User,      { foreignKey: 'payer_user_id',   as: 'payer' });

// ── Conversations & Messages ──────────────────────────────────────────────────
Client.hasMany(Conversation,      { foreignKey: 'client_id',      as: 'conversations', onDelete: 'CASCADE' });
Prestataire.hasMany(Conversation, { foreignKey: 'prestataire_id', as: 'conversations', onDelete: 'CASCADE' });
Conversation.belongsTo(Client,      { foreignKey: 'client_id',      as: 'client' });
Conversation.belongsTo(Prestataire, { foreignKey: 'prestataire_id', as: 'prestataire' });
Conversation.belongsTo(Booking,     { foreignKey: 'booking_id',     as: 'booking' });
Conversation.hasMany(Message,  { foreignKey: 'conversation_id', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
User.hasMany(Message,   { foreignKey: 'sender_user_id', as: 'messages_envoyés', onDelete: 'CASCADE' });
Message.belongsTo(User, { foreignKey: 'sender_user_id', as: 'sender' });

// ── Reviews ───────────────────────────────────────────────────────────────────
Booking.hasOne(Review,      { foreignKey: 'booking_id',     as: 'review',     onDelete: 'CASCADE' });
Review.belongsTo(Booking,   { foreignKey: 'booking_id',     as: 'booking' });
Client.hasMany(Review,      { foreignKey: 'client_id',      as: 'reviews',    onDelete: 'CASCADE' });
Review.belongsTo(Client,    { foreignKey: 'client_id',      as: 'client' });
Prestataire.hasMany(Review, { foreignKey: 'prestataire_id', as: 'reviews',    onDelete: 'CASCADE' });
Review.belongsTo(Prestataire, { foreignKey: 'prestataire_id', as: 'prestataire' });

// ── Notifications ─────────────────────────────────────────────────────────────
User.hasMany(Notification,  { foreignKey: 'user_id', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── AuditLogs ─────────────────────────────────────────────────────────────────
Admin.hasMany(AuditLog,   { foreignKey: 'admin_id', as: 'audit_logs', onDelete: 'SET NULL' });
AuditLog.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

// ── Posts & PostMedia ─────────────────────────────────────────────────────────
Prestataire.hasMany(Post,  { foreignKey: 'prestataire_id', as: 'posts', onDelete: 'CASCADE' });
Post.belongsTo(Prestataire, { foreignKey: 'prestataire_id', as: 'prestataire' });
Post.hasMany(PostMedia,    { foreignKey: 'post_id', as: 'media', onDelete: 'CASCADE' });
PostMedia.belongsTo(Post,  { foreignKey: 'post_id', as: 'post' });

// ── Favorites ─────────────────────────────────────────────────────────────────
Client.hasMany(Favorite,      { foreignKey: 'client_id',      as: 'favorites',  onDelete: 'CASCADE' });
Favorite.belongsTo(Client,    { foreignKey: 'client_id',      as: 'client' });
Prestataire.hasMany(Favorite, { foreignKey: 'prestataire_id', as: 'favorited_by', onDelete: 'CASCADE' });
Favorite.belongsTo(Prestataire, { foreignKey: 'prestataire_id', as: 'prestataire' });

module.exports = {
  sequelize,
  User, Client, Prestataire, Admin,
  Profile, Photo, Category,
  Subscription, Booking, Payment,
  Conversation, Message, Review,
  Notification, Setting, AuditLog,
  Post, PostMedia, Favorite, PayoutRequest,
};
