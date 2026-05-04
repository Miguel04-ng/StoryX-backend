const { sequelize, User, Client, Prestataire, Payment, Subscription, Review, Photo, Booking, AuditLog } = require('../models/index');
const { sendSuccess, sendError, getPagination, buildPaginationMeta } = require('../utils/helpers');
const { Op } = require('sequelize');

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    // Utiliser la vue vw_admin_stats définie dans le SQL
    const [rows] = await sequelize.query('SELECT * FROM vw_admin_stats LIMIT 1');
    const stats = rows[0] || {};

    // Stats paiements par provider
    const [paymentStats] = await sequelize.query(`
      SELECT provider, method, COUNT(*) as count, SUM(amount) as total
      FROM payments WHERE status = 'SUCCESS'
      GROUP BY provider, method
    `);

    return sendSuccess(res, 200, 'Statistiques récupérées.', { stats, paymentStats });
  } catch (error) { next(error); }
};

// ── GET /api/admin/users ──────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { role, search } = req.query;

    const where = { deleted_at: null };
    if (role)   where.role = role.toUpperCase();
    if (search) where.email = { [Op.like]: `%${search}%` };

    const { rows: users, count } = await User.findAndCountAll({
      where,
      include: [
        { model: Client,      as: 'client',      required: false, attributes: ['first_name', 'last_name', 'is_premium'] },
        { model: Prestataire, as: 'prestataire',  required: false, attributes: ['display_name', 'is_premium', 'is_verified'] },
      ],
      order:    [['created_at', 'DESC']],
      attributes: { exclude: ['password'] },
      limit, offset, distinct: true,
    });

    return sendSuccess(res, 200, 'Utilisateurs récupérés.', {
      users,
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) { next(error); }
};

// ── PATCH /api/admin/users/:id/toggle ─────────────────────────────────────────
const toggleUserActive = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return sendError(res, 404, 'Utilisateur introuvable.');
    if (user.role === 'ADMIN') return sendError(res, 403, 'Impossible de désactiver un admin.');

    await user.update({ is_active: user.is_active ? 0 : 1 });
    return sendSuccess(res, 200, `Compte ${user.is_active ? 'activé' : 'désactivé'}.`, {
      user: { id: user.id, is_active: user.is_active },
    });
  } catch (error) { next(error); }
};

// ── DELETE /api/admin/users/:id (soft delete) ─────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return sendError(res, 404, 'Utilisateur introuvable.');
    if (user.role === 'ADMIN') return sendError(res, 403, 'Impossible de supprimer un admin.');

    await user.update({ deleted_at: new Date(), is_active: 0 });
    return sendSuccess(res, 200, 'Utilisateur supprimé (soft delete).');
  } catch (error) { next(error); }
};

// ── PATCH /api/admin/prestataires/:id/verify ──────────────────────────────────
const verifyPrestataire = async (req, res, next) => {
  try {
    const prest = await Prestataire.findByPk(req.params.id);
    if (!prest) return sendError(res, 404, 'Prestataire introuvable.');

    await prest.update({ is_verified: 1, badge_verified: 1 });
    return sendSuccess(res, 200, 'Prestataire vérifié.', { prestataire: prest });
  } catch (error) { next(error); }
};

// ── PATCH /api/admin/reviews/:id/approve ─────────────────────────────────────
const approveReview = async (req, res, next) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return sendError(res, 404, 'Avis introuvable.');

    const isApproved = req.body.is_approved !== undefined ? req.body.is_approved : 1;
    await review.update({
      is_approved:  isApproved,
      moderated_at: new Date(),
    });

    // Le trigger MySQL recalcule rating_avg automatiquement

    return sendSuccess(res, 200, `Avis ${isApproved ? 'approuvé' : 'refusé'}.`);
  } catch (error) { next(error); }
};

// ── GET /api/admin/payments ───────────────────────────────────────────────────
const getAllPayments = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, provider } = req.query;
    const where = {};
    if (status)   where.status   = status;
    if (provider) where.provider = provider;

    const { rows: payments, count } = await Payment.findAndCountAll({
      where,
      include: [{ model: User, as: 'payer', attributes: ['id', 'email', 'role'] }],
      attributes: { exclude: ['provider_raw'] },
      order: [['created_at', 'DESC']],
      limit, offset, distinct: true,
    });

    const [revAgg] = await sequelize.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM payments WHERE status = 'SUCCESS'`
    );

    return sendSuccess(res, 200, 'Paiements récupérés.', {
      payments,
      pagination: buildPaginationMeta(count, page, limit),
      stats: {
        totalRevenue: parseFloat(revAgg[0]?.total || 0),
        successCount: parseInt(revAgg[0]?.count || 0),
        currency:     'FCFA',
      },
    });
  } catch (error) { next(error); }
};

// ── GET /api/admin/photos/pending ─────────────────────────────────────────────
const getPendingPhotos = async (req, res, next) => {
  try {
    const photos = await Photo.findAll({
      where:   { is_approved: 0 },
      include: [{ model: require('./index').Profile, as: 'profile', include: [{ model: Prestataire, as: 'prestataire' }] }],
      order:   [['uploaded_at', 'ASC']],
      limit:   50,
    });
    return sendSuccess(res, 200, 'Photos en attente.', { photos });
  } catch (error) { next(error); }
};

// ── GET /api/admin/prestataires/pending ──────────────────────────────────────
const getPendingPrestataires = async (req, res, next) => {
  try {
    const [rows] = await sequelize.query(`
      SELECT 
        u.id as user_id,
        u.email,
        u.created_at,
        p.id as prestataire_id,
        p.display_name,
        a.new_values as dossier
      FROM users u
      LEFT JOIN prestataires p ON p.user_id = u.id
      LEFT JOIN audit_logs a ON a.user_id = u.id AND a.action = 'prestataire.inscription'
      WHERE u.role = 'PRESTATAIRE' 
        AND u.is_active = 0 
        AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `);

    return sendSuccess(res, 200, 'Prestataires en attente.', {
      prestataires: rows,
      count: rows.length,
    });
  } catch (error) { next(error); }
};

// ── PATCH /api/admin/prestataires/:id/admit ───────────────────────────────────
const admitPrestataire = async (req, res, next) => {
  try {
    const { id } = req.params;           // user_id
    const { action } = req.body;         // 'approve' | 'reject'

    const user = await User.findOne({
      where: { id, role: 'PRESTATAIRE', is_active: 0 },
    });
    if (!user) return sendError(res, 404, 'Prestataire introuvable ou déjà traité.');

    if (action === 'approve') {
      await user.update({ is_active: 1, email_verified_at: new Date() });
      await AuditLog.create({
        admin_id:    req.user.admin?.id || null,
        user_id:     user.id,
        action:      'prestataire.approved',
        entity_type: 'users',
        entity_id:   user.id,
        new_values:  { approved_by: req.user.email, approved_at: new Date() },
      });
      return sendSuccess(res, 200, 'Prestataire approuvé. Son compte est maintenant actif.');
    } else if (action === 'reject') {
      await user.update({ deleted_at: new Date(), is_active: 0 });
      await AuditLog.create({
        admin_id:    req.user.admin?.id || null,
        user_id:     user.id,
        action:      'prestataire.rejected',
        entity_type: 'users',
        entity_id:   user.id,
        new_values:  { rejected_by: req.user.email, reason: req.body.reason || 'Non conforme' },
      });
      return sendSuccess(res, 200, 'Prestataire rejeté.');
    }

    return sendError(res, 400, 'Action invalide. Utilisez "approve" ou "reject".');
  } catch (error) { next(error); }
};

module.exports = {
  getStats, getUsers, toggleUserActive, deleteUser,
  verifyPrestataire, approveReview, getAllPayments, getPendingPhotos,
  getPendingPrestataires, admitPrestataire,
};
