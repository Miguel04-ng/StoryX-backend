const jwt  = require('jsonwebtoken');
const { User, Client, Prestataire, Admin } = require('../models/index');
const { sendError } = require('../utils/helpers');

// ── Vérification JWT ──────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return sendError(res, 401, 'Token manquant. Connectez-vous.');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupérer l'user avec son profil étendu selon le rôle
    const user = await User.findOne({
      where: { id: decoded.id, is_active: 1, deleted_at: null },
      include: [
        { model: Client,      as: 'client',      required: false },
        { model: Prestataire, as: 'prestataire',  required: false },
        { model: Admin,       as: 'admin',        required: false },
      ],
    });

    if (!user) return sendError(res, 401, 'Utilisateur introuvable ou compte désactivé.');

    req.user       = user;
    req.client     = user.client      || null;
    req.prestataire = user.prestataire || null;
    req.isAdmin    = user.role === 'ADMIN';
    req.isPremium  = user.role === 'CLIENT'
      ? (user.client?.is_premium === 1)
      : (user.prestataire?.is_premium === 1);

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError')  return sendError(res, 401, 'Token invalide.');
    if (err.name === 'TokenExpiredError')  return sendError(res, 401, 'Session expirée. Reconnectez-vous.');
    next(err);
  }
};

// ── Restriction par rôle ──────────────────────────────────────────────────────
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return sendError(res, 403, `Accès réservé aux : ${roles.join(', ')}.`);
  }
  next();
};

// ── Auth optionnelle (pour les routes publiques) ───────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      where: { id: decoded.id, is_active: 1, deleted_at: null },
      include: [
        { model: Client,      as: 'client',      required: false },
        { model: Prestataire, as: 'prestataire',  required: false },
      ],
    });
    if (user) {
      req.user      = user;
      req.isPremium = user.role === 'CLIENT'
        ? (user.client?.is_premium === 1)
        : (user.prestataire?.is_premium === 1);
    }
  } catch { /* silencieux */ }
  next();
};

module.exports = { protect, restrictTo, optionalAuth };
