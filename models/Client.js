const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Client = sequelize.define('Client', {
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
  first_name: {
    type:      DataTypes.STRING(100),
    allowNull: false,
  },
  last_name: {
    type:      DataTypes.STRING(100),
    allowNull: false,
  },
  phone: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },
  avatar_url: {
    type:      DataTypes.STRING(500),
    allowNull: true,
  },
  is_premium: {
    type:         DataTypes.TINYINT(1),
    defaultValue: 0,
  },
  premium_since: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
  // Champ virtuel pour le tracking freemium (non stocké en DB)
  daily_requests_count: {
    type:         DataTypes.VIRTUAL,
    defaultValue: 0,
  },
  daily_requests_date: {
    type:         DataTypes.VIRTUAL,
    defaultValue: null,
  },
}, {
  tableName:  'clients',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

module.exports = Client;
