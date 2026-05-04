const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// ── Subscription ──────────────────────────────────────────────────────────────
const Subscription = sequelize.define('Subscription', {
  id:       { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:  { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  type: {
    type:      DataTypes.ENUM('CLIENT_PREMIUM', 'PRESTATAIRE_PREMIUM', 'PRESTATAIRE_BOOST'),
    allowNull: false,
  },
  status: {
    type:         DataTypes.ENUM('PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED'),
    defaultValue: 'PENDING',
  },
  price:        { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency:     { type: DataTypes.STRING(10), defaultValue: 'FCFA' },
  start_date:   { type: DataTypes.DATE, allowNull: false },
  end_date:     { type: DataTypes.DATE, allowNull: false },
  auto_renew:   { type: DataTypes.TINYINT(1), defaultValue: 0 },
  cancelled_at: { type: DataTypes.DATE, allowNull: true },
  cancel_reason:{ type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName:  'subscriptions',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

// ── Booking ───────────────────────────────────────────────────────────────────
const Booking = sequelize.define('Booking', {
  id:             { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  client_id:      { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  prestataire_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  status: {
    type: DataTypes.ENUM(
      'PENDING', 'CONFIRMED', 'CANCELLED_CLIENT',
      'CANCELLED_PRESTATAIRE', 'COMPLETED', 'DISPUTED'
    ),
    defaultValue: 'PENDING',
  },
  booking_date:     { type: DataTypes.DATE, allowNull: false },
  duration_hours:   { type: DataTypes.DECIMAL(4, 2), allowNull: true },
  location:         { type: DataTypes.STRING(255), allowNull: true },
  note_client:      { type: DataTypes.TEXT, allowNull: true },
  note_prestataire: { type: DataTypes.TEXT, allowNull: true },
  amount:           { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  commission_rate:  { type: DataTypes.DECIMAL(5, 2), defaultValue: 15.00 },
  commission_amt:   { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
  confirmed_at:     { type: DataTypes.DATE, allowNull: true },
  cancelled_at:     { type: DataTypes.DATE, allowNull: true },
  completed_at:     { type: DataTypes.DATE, allowNull: true },
}, {
  tableName:  'bookings',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

// ── Payment ───────────────────────────────────────────────────────────────────
const Payment = sequelize.define('Payment', {
  id:              { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  booking_id:      { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  subscription_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  payer_user_id:   { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  amount:          { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency:        { type: DataTypes.STRING(10), defaultValue: 'FCFA' },
  method: {
    type: DataTypes.ENUM('MOBILE_MONEY', 'ORANGE_MONEY', 'MTN_MOMO', 'CARD', 'WAVE', 'CASH', 'OTHER'),
    allowNull: false,
  },
  status: {
    type:         DataTypes.ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'),
    defaultValue: 'PENDING',
  },
  provider_ref: { type: DataTypes.STRING(255), allowNull: true },
  provider_raw: { type: DataTypes.JSON, allowNull: true },
  paid_at:      { type: DataTypes.DATE, allowNull: true },
  refunded_at:  { type: DataTypes.DATE, allowNull: true },
  refund_amount:{ type: DataTypes.DECIMAL(10, 2), allowNull: true },
  // Champs supplémentaires pour la logique paiement
  storyx_reference: { type: DataTypes.STRING(100), allowNull: true, unique: true },
  provider:     { type: DataTypes.ENUM('cinetpay', 'flutterwave', 'manual'), defaultValue: 'manual' },
  duree_mois:   { type: DataTypes.TINYINT.UNSIGNED, defaultValue: 1 },
  payment_url:  { type: DataTypes.STRING(1000), allowNull: true },
}, {
  tableName:  'payments',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

// ── Conversation ──────────────────────────────────────────────────────────────
const Conversation = sequelize.define('Conversation', {
  id:             { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  client_id:      { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  prestataire_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  booking_id:     { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  last_message_at:{ type: DataTypes.DATE, allowNull: true },
  is_locked:      { type: DataTypes.TINYINT(1), defaultValue: 0 },
}, {
  tableName:  'conversations',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
  indexes: [{ unique: true, fields: ['client_id', 'prestataire_id'] }],
});

// ── Message ───────────────────────────────────────────────────────────────────
const Message = sequelize.define('Message', {
  id:              { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  conversation_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  sender_user_id:  { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  content:         { type: DataTypes.TEXT, allowNull: false },
  type: {
    type:         DataTypes.ENUM('TEXT', 'IMAGE', 'SYSTEM'),
    defaultValue: 'TEXT',
  },
  is_read:    { type: DataTypes.TINYINT(1), defaultValue: 0 },
  read_at:    { type: DataTypes.DATE, allowNull: true },
  deleted_at: { type: DataTypes.DATE, allowNull: true },
  sent_at:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName:  'messages',
  timestamps: false,
});

// ── Review ────────────────────────────────────────────────────────────────────
const Review = sequelize.define('Review', {
  id:             { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  booking_id:     { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
  client_id:      { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  prestataire_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  rating: {
    type:      DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    validate:  { min: 1, max: 5 },
  },
  comment:      { type: DataTypes.TEXT, allowNull: true },
  is_approved:  { type: DataTypes.TINYINT(1), defaultValue: 0 },
  is_flagged:   { type: DataTypes.TINYINT(1), defaultValue: 0 },
  moderated_at: { type: DataTypes.DATE, allowNull: true },
  moderated_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
}, {
  tableName:  'reviews',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

// ── AuditLog ──────────────────────────────────────────────────────────────────
const AuditLog = sequelize.define('AuditLog', {
  id:          { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  admin_id:    { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  user_id:     { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  action:      { type: DataTypes.STRING(150), allowNull: false },
  entity_type: { type: DataTypes.STRING(100), allowNull: true },
  entity_id:   { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  old_values:  { type: DataTypes.JSON, allowNull: true },
  new_values:  { type: DataTypes.JSON, allowNull: true },
  ip_address:  { type: DataTypes.STRING(45), allowNull: true },
  user_agent:  { type: DataTypes.STRING(512), allowNull: true },
}, {
  tableName:  'audit_logs',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
});

module.exports = {
  Subscription, Booking, Payment,
  Conversation, Message, Review, AuditLog,
};
