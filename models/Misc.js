const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// ── Profile ───────────────────────────────────────────────────────────────────
const Profile = sequelize.define('Profile', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  prestataire_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
  localisation:   { type: DataTypes.STRING(255), allowNull: true },
  ville:          { type: DataTypes.STRING(100), allowNull: true },
  pays:           { type: DataTypes.STRING(100), defaultValue: 'Cameroun' },
  latitude:       { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude:      { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  disponibilites: { type: DataTypes.TEXT, allowNull: true },
  categories: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  langues: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  cover_photo_url:   { type: DataTypes.STRING(500), allowNull: true },
  is_photos_blurred: { type: DataTypes.TINYINT(1), defaultValue: 1 },
  view_count:        { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
}, {
  tableName:  'profiles',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

// ── Photo ─────────────────────────────────────────────────────────────────────
const Photo = sequelize.define('Photo', {
  id:          { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  profile_id:  { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  url:         { type: DataTypes.STRING(500), allowNull: false },
  url_blurred: { type: DataTypes.STRING(500), allowNull: true },
  watermark:   { type: DataTypes.TINYINT(1), defaultValue: 1 },
  is_cover:    { type: DataTypes.TINYINT(1), defaultValue: 0 },
  is_approved: { type: DataTypes.TINYINT(1), defaultValue: 0 },
  sort_order:  { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
  uploaded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName:  'photos',
  timestamps: false,
});

// ── Category ──────────────────────────────────────────────────────────────────
const Category = sequelize.define('Category', {
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name:        { type: DataTypes.STRING(100), allowNull: false },
  slug:        { type: DataTypes.STRING(100), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  is_active:   { type: DataTypes.TINYINT(1), defaultValue: 1 },
}, {
  tableName:  'categories',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
});

// ── Admin ─────────────────────────────────────────────────────────────────────
const Admin = sequelize.define('Admin', {
  id:          { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:     { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
  first_name:  { type: DataTypes.STRING(100), allowNull: false },
  last_name:   { type: DataTypes.STRING(100), allowNull: false },
  permissions: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName:  'admins',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

// ── Notification ──────────────────────────────────────────────────────────────
const Notification = sequelize.define('Notification', {
  id:         { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:    { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  type:       { type: DataTypes.STRING(100), allowNull: false },
  title:      { type: DataTypes.STRING(255), allowNull: false },
  body:       { type: DataTypes.TEXT, allowNull: true },
  data:       { type: DataTypes.JSON, allowNull: true },
  is_read:    { type: DataTypes.TINYINT(1), defaultValue: 0 },
  read_at:    { type: DataTypes.DATE, allowNull: true },
}, {
  tableName:  'notifications',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
});

// ── Setting ───────────────────────────────────────────────────────────────────
const Setting = sequelize.define('Setting', {
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  key_name:    { type: DataTypes.STRING(150), allowNull: false, unique: true },
  value:       { type: DataTypes.TEXT, allowNull: false },
  type: {
    type:      DataTypes.ENUM('STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'JSON'),
    defaultValue: 'STRING',
  },
  description: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName:  'settings',
  timestamps: true,
  createdAt:  false,
  updatedAt:  'updated_at',
});

module.exports = { Profile, Photo, Category, Admin, Notification, Setting };
