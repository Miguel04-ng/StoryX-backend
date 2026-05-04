const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME     || 'storyx',
  process.env.DB_USER     || 'root',
  process.env.DB_PASSWORD || '',
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',

    pool: {
      max:     parseInt(process.env.DB_POOL_MAX)     || 10,
      min:     parseInt(process.env.DB_POOL_MIN)     || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle:    parseInt(process.env.DB_POOL_IDLE)    || 10000,
    },

    logging: process.env.NODE_ENV === 'development'
      ? (msg) => console.log(`\x1b[36m[SQL]\x1b[0m ${msg}`)
      : false,

    define: {
      // Les noms de tables dans le SQL sont snake_case — on les conserve
      underscored:   true,
      freezeTableName: true,
      timestamps:    true,
      createdAt:     'created_at',
      updatedAt:     'updated_at',
    },

    dialectOptions: {
      charset: 'utf8mb4',
      // Nécessaire pour parser les colonnes DATETIME correctement
      dateStrings: true,
      typeCast: true,
    },
    timezone: '+00:00',
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connecté via Sequelize');
  } catch (error) {
    console.error('❌ Connexion MySQL échouée :', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
