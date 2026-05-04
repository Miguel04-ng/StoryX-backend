require('dotenv').config();
const app       = require('./app');
const { connectDB, sequelize } = require('./config/db');
const { expireSubscriptions }  = require('./services/premiumService');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║      STORYX BACKEND v2.0 — MySQL             ║');
      console.log('╠══════════════════════════════════════════════╣');
      console.log(`║  Port     : ${PORT}                               ║`);
      console.log(`║  Env      : ${process.env.NODE_ENV || 'development'}                    ║`);
      console.log(`║  DB       : ${process.env.DB_NAME || 'storyx'}@${process.env.DB_HOST || 'localhost'}           ║`);
      console.log(`║  API      : http://localhost:${PORT}/api          ║`);
      console.log('╚══════════════════════════════════════════════╝');
    });

    // Cron : expirer les abonnements toutes les heures
    setInterval(async () => {
      try { await expireSubscriptions(); }
      catch (e) { console.error('Cron expireSubscriptions :', e.message); }
    }, 60 * 60 * 1000);

    // Arrêt propre
    const shutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} reçu — arrêt propre...`);
      server.close(async () => {
        await sequelize.close();
        console.log('✅ Connexion MySQL fermée.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('unhandledRejection', (err) => {
      console.error('❌ unhandledRejection :', err.message);
      server.close(() => process.exit(1));
    });
  } catch (err) {
    console.error('❌ Démarrage impossible :', err.message);
    process.exit(1);
  }
};

start();
