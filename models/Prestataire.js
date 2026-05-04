const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Prestataire = sequelize.define('Prestataire', {
  id: {
    type:          DataTypes.BIGINT.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  user_id: {
    type:      DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    unique:    true,
  },
  display_name: {
    type:      DataTypes.STRING(150),
    allowNull: false,
  },
  description: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  tarif_min: {
    type:      DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  tarif_max: {
    type:      DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  is_premium: {
    type:         DataTypes.TINYINT(1),
    defaultValue: 0,
  },
  is_verified: {
    type:         DataTypes.TINYINT(1),
    defaultValue: 0,
  },
  badge_verified: {
    type:         DataTypes.TINYINT(1),
    defaultValue: 0,
  },
  boost_until: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
  rating_avg: {
    type:         DataTypes.DECIMAL(3, 2),
    defaultValue: 0.00,
  },
  rating_count: {
    type:         DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
  },
}, {
  tableName:  'prestataires',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

module.exports = Prestataire;
