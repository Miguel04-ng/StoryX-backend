const { User, Client, Prestataire, Subscription } = require('../models/index');

// ── Cache en mémoire ─────────────────────────────────────────────────────────
// Structure : { count, date, messageCount }
const userCache = new Map();

const getCacheKey = (userId) => `u_${userId}`;
const isNewDay    = (date) => !date || new Date(date).toDateString() !== new Date().toDateString();

// ── Limites ───────────────────────────────────────────────────────────────────
const LIMITS = {
  FREE_DAILY_REQUESTS: () => parseInt(process.env.FREE_DAILY_REQUESTS) || 3,
  FREE_MESSAGES_TOTAL: 10,   // Total messages gratuits (pas journalier)
};

// ── Vérifier et incrémenter les DEMANDES journalières (réservations) ──────────
const checkAndIncrementRequest = async (userId, isPremium) => {
  if (isPremium) return { allowed: true, remaining: 'illimité', isPremium: true };

  const key   = getCacheKey(userId);
  let   cache = userCache.get(key) || { count: 0, date: new Date(), messageCount: 0 };

  if (isNewDay(cache.date)) {
    cache = { ...cache, count: 0, date: new Date() };
  }

  const limit = LIMITS.FREE_DAILY_REQUESTS();

  if (cache.count >= limit) {
    return {
      allowed:   false,
      remaining: 0,
      message:   `Limite de ${limit} demandes/jour atteinte. Passez en Premium pour un accès illimité.`,
    };
  }

  cache.count++;
  userCache.set(key, cache);

  return { allowed: true, remaining: limit - cache.count, isPremium: false };
};

// ── Vérifier et incrémenter les MESSAGES (limite totale pour gratuits) ─────────
const checkAndIncrementMessage = async (userId, isPremium) => {
  if (isPremium) return { allowed: true, remaining: 'illimité' };

  const key   = getCacheKey(userId);
  let   cache = userCache.get(key) || { count: 0, date: new Date(), messageCount: 0 };

  const limit = LIMITS.FREE_MESSAGES_TOTAL;

  if (cache.messageCount >= limit) {
    return {
      allowed:   false,
      remaining: 0,
      message:   `Vous avez atteint votre limite de ${limit} messages gratuits. Passez en Premium pour envoyer des messages illimités.`,
    };
  }

  cache.messageCount++;
  userCache.set(key, cache);

  return { allowed: true, remaining: limit - cache.messageCount };
};

// ── Obtenir les stats de l'utilisateur ────────────────────────────────────────
const getUserStats = (userId, isPremium) => {
  const key   = getCacheKey(userId);
  const cache = userCache.get(key) || { count: 0, date: new Date(), messageCount: 0 };
  const reqLimit = LIMITS.FREE_DAILY_REQUESTS();
  const msgLimit = LIMITS.FREE_MESSAGES_TOTAL;

  if (isNewDay(cache.date)) {
    return {
      demandesAujourdhui: 0,
      demandesRestantes:  isPremium ? 'illimitées' : reqLimit,
      messagesEnvoyes:    cache.messageCount || 0,
      messagesRestants:   isPremium ? 'illimités' : Math.max(0, msgLimit - (cache.messageCount || 0)),
    };
  }

  return {
    demandesAujourdhui: cache.count || 0,
    demandesRestantes:  isPremium ? 'illimitées' : Math.max(0, reqLimit - (cache.count || 0)),
    messagesEnvoyes:    cache.messageCount || 0,
    messagesRestants:   isPremium ? 'illimités' : Math.max(0, msgLimit - (cache.messageCount || 0)),
  };
};

// ── Activer le premium ────────────────────────────────────────────────────────
const activatePremium = async (userId, options = {}) => {
  const { montant = 0, methodePaiement = 'manual', dureeMois = 1, transactionRef = null } = options;

  const user = await User.findByPk(userId);
  if (!user) throw new Error('Utilisateur introuvable');

  await Subscription.update(
    { status: 'CANCELLED', cancelled_at: new Date(), cancel_reason: 'Remplacé' },
    { where: { user_id: userId, status: 'ACTIVE' } }
  );

  const startDate = new Date();
  const endDate   = new Date();
  endDate.setMonth(endDate.getMonth() + dureeMois);

  const subscription = await Subscription.create({
    user_id:    userId,
    type:       user.role === 'PRESTATAIRE' ? 'PRESTATAIRE_PREMIUM' : 'CLIENT_PREMIUM',
    status:     'ACTIVE',
    price:      montant,
    currency:   'FCFA',
    start_date: startDate,
    end_date:   endDate,
    auto_renew: 0,
  });

  if (user.role === 'CLIENT') {
    await Client.update({ is_premium: 1, premium_since: new Date() }, { where: { user_id: userId } });
  } else if (user.role === 'PRESTATAIRE') {
    await Prestataire.update({ is_premium: 1 }, { where: { user_id: userId } });
  }

  // Réinitialiser le cache pour cet utilisateur
  userCache.delete(getCacheKey(userId));

  console.log(`✅ Premium activé : userId=${userId} | ${dureeMois} mois | ref=${transactionRef}`);
  return subscription;
};

// ── Expirer les abonnements ───────────────────────────────────────────────────
const expireSubscriptions = async () => {
  const { Op } = require('sequelize');
  const expired = await Subscription.findAll({
    where: { status: 'ACTIVE', end_date: { [Op.lt]: new Date() } },
    include: [{ model: User, as: 'user', attributes: ['id', 'role'] }],
  });

  for (const sub of expired) {
    await sub.update({ status: 'EXPIRED' });
    if (sub.user.role === 'CLIENT') {
      await Client.update({ is_premium: 0 }, { where: { user_id: sub.user_id } });
    } else if (sub.user.role === 'PRESTATAIRE') {
      await Prestataire.update({ is_premium: 0 }, { where: { user_id: sub.user_id } });
    }
  }

  if (expired.length > 0) console.log(`⏰ ${expired.length} abonnement(s) expiré(s)`);
};

// ── Statut premium complet ────────────────────────────────────────────────────
const getPremiumStatus = async (userId, isPremium) => {
  const { Op } = require('sequelize');
  const activeSub = await Subscription.findOne({
    where: { user_id: userId, status: 'ACTIVE', end_date: { [Op.gt]: new Date() } },
    order: [['end_date', 'DESC']],
  });

  const stats = getUserStats(userId, isPremium);

  return {
    isPremium,
    subscription: activeSub ? {
      type:          activeSub.type,
      dateFin:       activeSub.end_date,
      joursRestants: Math.max(0, Math.ceil((new Date(activeSub.end_date) - new Date()) / 86400000)),
    } : null,
    limiteJournaliere:  isPremium ? 'illimitée' : LIMITS.FREE_DAILY_REQUESTS(),
    limitMessages:      isPremium ? 'illimité'  : LIMITS.FREE_MESSAGES_TOTAL,
    ...stats,
  };
};

module.exports = {
  checkAndIncrementRequest,
  checkAndIncrementMessage,
  getUserStats,
  activatePremium,
  expireSubscriptions,
  getPremiumStatus,
  LIMITS,
};
