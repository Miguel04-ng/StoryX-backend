// ── errorHandler.js ───────────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  let status  = err.status || err.statusCode || 500;
  let message = err.message || 'Erreur serveur interne';

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    status  = 409;
    const field = err.errors?.[0]?.path || 'champ';
    message = field === 'email'
      ? 'Un compte avec cet email existe déjà.'
      : `La valeur du champ "${field}" est déjà utilisée.`;
  }

  // Sequelize validation
  if (err.name === 'SequelizeValidationError') {
    status  = 422;
    message = err.errors.map(e => e.message).join('. ');
  }

  // Sequelize foreign key
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    status  = 400;
    message = 'Référence invalide : entité liée introuvable.';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('🔴 ERREUR :', err);
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const notFound = (req, res) =>
  res.status(404).json({
    success: false,
    message: `Route introuvable : ${req.method} ${req.originalUrl}`,
  });

module.exports = { errorHandler, notFound };
