const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type:          DataTypes.BIGINT.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  email: {
    type:      DataTypes.STRING(191),
    allowNull: false,
    unique:    true,
    validate:  { isEmail: true },
  },
  password: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type:         DataTypes.ENUM('CLIENT', 'PRESTATAIRE', 'ADMIN'),
    allowNull:    false,
    defaultValue: 'CLIENT',
  },
  is_active: {
    type:         DataTypes.TINYINT(1),
    defaultValue: 1,
  },
  email_verified_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
  last_login_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
  deleted_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
  // Tracking freemium — stocké comme JSON en mémoire, pas en DB
  // On utilise une colonne virtuelle pour le daily_requests
}, {
  tableName:  'users',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
  paranoid:   false, // On gère le soft delete manuellement via deleted_at
});

module.exports = User;
