const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// ── Post ──────────────────────────────────────────────────────────────────────
const Post = sequelize.define('Post', {
  id:             { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  prestataire_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  content:        { type: DataTypes.TEXT, allowNull: true },
  type: {
    type:         DataTypes.ENUM('TEXT', 'PHOTO', 'VIDEO', 'MIXED'),
    defaultValue: 'TEXT',
  },
  is_premium_only: { type: DataTypes.TINYINT(1), defaultValue: 0 },
  is_approved:     { type: DataTypes.TINYINT(1), defaultValue: 1 },
  views_count:     { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
}, {
  tableName:  'posts',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

// ── PostMedia ─────────────────────────────────────────────────────────────────
const PostMedia = sequelize.define('PostMedia', {
  id:          { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  post_id:     { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  type:        { type: DataTypes.ENUM('PHOTO', 'VIDEO'), defaultValue: 'PHOTO' },
  url:         { type: DataTypes.STRING(1000), allowNull: false },
  url_blurred: { type: DataTypes.STRING(1000), allowNull: true },
  thumbnail:   { type: DataTypes.STRING(1000), allowNull: true },
  duration:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  sort_order:  { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
}, {
  tableName:  'post_media',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
});

// ── Favorite ──────────────────────────────────────────────────────────────────
const Favorite = sequelize.define('Favorite', {
  id:             { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  client_id:      { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  prestataire_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
}, {
  tableName:  'favorites',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
  indexes: [{ unique: true, fields: ['client_id', 'prestataire_id'] }],
});

// ── PayoutRequest ─────────────────────────────────────────────────────────────
const PayoutRequest = sequelize.define('PayoutRequest', {
  id:             { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  booking_id:     { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
  prestataire_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  amount_total:   { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  commission_pct: { type: DataTypes.DECIMAL(5, 2), defaultValue: 20.00 },
  commission_amt: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  payout_amt:     { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status:         { type: DataTypes.ENUM('PENDING', 'PAID', 'FAILED'), defaultValue: 'PENDING' },
  paid_at:        { type: DataTypes.DATE, allowNull: true },
  note:           { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName:  'payout_requests',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

module.exports = { Post, PostMedia, Favorite, PayoutRequest };
