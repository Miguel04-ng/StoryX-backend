const { Op } = require('sequelize');
const { sequelize, Prestataire, User, Profile, Photo, Category } = require('../models/index');
const { sendSuccess, sendError, getPagination, buildPaginationMeta } = require('../utils/helpers');
const { applyPhotoAccess } = require('./mainController');

// ── GET /api/profiles ─────────────────────────────────────────────────────────
const getProfiles = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { ville, minPrix, maxPrix, tri } = req.query;

    const where = {};
    const profileWhere = {};

    if (ville)   profileWhere.ville  = { [Op.like]: `%${ville}%` };
    if (minPrix) where.tarif_min     = { [Op.gte]: parseFloat(minPrix) };
    if (maxPrix) where.tarif_max     = { [Op.lte]: parseFloat(maxPrix) };

    const orderMap = {
      populaire: [['rating_avg', 'DESC'], ['rating_count', 'DESC']],
      nouveau:   [['created_at', 'DESC']],
      prix_asc:  [['tarif_min', 'ASC']],
      prix_desc: [['tarif_max', 'DESC']],
    };
    const order = orderMap[tri] || [['is_premium', 'DESC'], ['rating_avg', 'DESC']];

    const { rows: prestataires, count: total } = await Prestataire.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'created_at'], where: { is_active: 1, deleted_at: null }, required: true },
        {
          model:    Profile,
          as:       'profile',
          required: false,
          where:    Object.keys(profileWhere).length ? profileWhere : undefined,
          include:  [{
            model:    Photo,
            as:       'photos',
            required: false,
            where:    { is_approved: 1 },
            // Récupérer toutes les photos pour appliquer la logique d'accès
            order:    [['is_cover', 'DESC'], ['sort_order', 'ASC']],
          }],
        },
      ],
      order,
      limit, offset, distinct: true,
    });

    const isPremiumViewer = req.isPremium || false;

    const result = prestataires.map(p => {
      const plain  = p.toJSON();
      const allPhotos = plain.profile?.photos || [];

      // Appliquer la logique : 3 premières visibles, reste flouté si non-premium
      const photos = applyPhotoAccess(allPhotos, isPremiumViewer);

      return {
        id:            plain.id,
        user_id:       plain.user_id,
        display_name:  plain.display_name,
        description:   plain.description,
        tarif_min:     plain.tarif_min,
        tarif_max:     plain.tarif_max,
        is_premium:    plain.is_premium,
        is_verified:   plain.is_verified,
        badge_verified: plain.badge_verified,
        rating_avg:    plain.rating_avg,
        rating_count:  plain.rating_count,
        ville:         plain.profile?.ville,
        localisation:  plain.profile?.localisation,
        view_count:    plain.profile?.view_count || 0,
        cover_photo:   photos.find(ph => ph.is_cover) || photos[0] || null,
        photos:        photos.slice(0, 3), // Dans la liste : max 3
        total_photos:  allPhotos.length,
      };
    });

    return sendSuccess(res, 200, 'Profils récupérés.', {
      profiles: result,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) { next(error); }
};

// ── GET /api/profiles/:id ─────────────────────────────────────────────────────
const getProfileById = async (req, res, next) => {
  try {
    const prestataire = await Prestataire.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'created_at', 'is_active'] },
        {
          model:    Profile,
          as:       'profile',
          required: false,
          include:  [{
            model:    Photo,
            as:       'photos',
            where:    { is_approved: 1 },
            required: false,
            order:    [['is_cover', 'DESC'], ['sort_order', 'ASC']],
          }],
        },
      ],
    });

    if (!prestataire || !prestataire.user?.is_active || prestataire.user?.deleted_at) {
      return sendError(res, 404, 'Profil introuvable.');
    }

    // Incrémenter les vues à chaque visite
    if (prestataire.profile) {
      await prestataire.profile.increment('view_count');
    }

    const isPremiumViewer = req.isPremium || false;
    const plain = prestataire.toJSON();
    const allPhotos = plain.profile?.photos || [];

    // Appliquer la logique d'accès photos :
    // 3 premières : toujours visibles
    // 4e et + : floutées si non-premium
    const photos = applyPhotoAccess(allPhotos, isPremiumViewer);

    return sendSuccess(res, 200, 'Profil récupéré.', {
      profile: {
        ...plain,
        profile: plain.profile ? {
          ...plain.profile,
          photos,
          total_photos: allPhotos.length,
          photos_locked: !isPremiumViewer && allPhotos.length > 3 ? allPhotos.length - 3 : 0,
        } : null,
        _premium_required: !isPremiumViewer && allPhotos.length > 3,
      },
    });
  } catch (error) { next(error); }
};

// ── POST/PUT /api/profiles ────────────────────────────────────────────────────
const upsertProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'PRESTATAIRE') {
      return sendError(res, 403, 'Seuls les prestataires peuvent gérer un profil.');
    }

    const { display_name, description, tarif_min, tarif_max, ville, localisation, disponibilites, photo_profil } = req.body;

    await Prestataire.update(
      { display_name, description, tarif_min, tarif_max },
      { where: { user_id: req.user.id } }
    );

    const [profile] = await Profile.upsert({
      prestataire_id: req.prestataire.id,
      ville,
      localisation,
      disponibilites,
    });
    //Sauvegarder la photo du profil si fournie
    if(photo_profil) {
      const { saveBase64Image } = require('../middleware/upload');
      const url = saveBase64Image(photo_profil, `profil_${req.prestataire.id}`);
      if(url) {
        const profileId = profile.id || profile.dataValues.id;
        //Chercher si une photo de couverture existe déjà
        const existing = await Photo.findOne({
          where: { profile_id: profileId, is_cover: 1 }
        })
        if(existing){
          await existing.update({ url });
        } else {
            await Photo.create({
            profile_id: profileId,
            url,
            is_cover: 1,
            is_approved: 1,
            sort_order: 0,
          });
        }
      }
    }
    return sendSuccess(res, 200, 'Profil mis à jour.', { profile });
  } catch (error) { next(error); }
};

// ── GET /api/profiles/mine ────────────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'PRESTATAIRE') {
      return sendError(res, 403, 'Seuls les prestataires ont un profil prestataire.');
    }

    const profile = await Prestataire.findOne({
      where: { user_id: req.user.id },
      include: [{
        model:    Profile,
        as:       'profile',
        required: false,
        include:  [{ model: Photo, as: 'photos', required: false, order: [['sort_order', 'ASC']] }],
      }],
    });

    // Le prestataire voit TOUTES ses photos sans floutage
    const plain = profile?.toJSON();
    if (plain?.profile?.photos) {
      plain.profile.photos = plain.profile.photos.map(ph => ({
        ...ph,
        is_blurred: false, // Toujours visible pour le propriétaire
      }));
    }

    return sendSuccess(res, 200, 'Mon profil.', { profile: plain });
  } catch (error) { next(error); }
};

// ── GET /api/profiles/:id/stats ───────────────────────────────────────────────
const getProfileStats = async (req, res, next) => {
  try {
    if (req.user.role !== 'PRESTATAIRE') {
      return sendError(res, 403, 'Réservé aux prestataires.');
    }

    const profile = await Profile.findOne({ where: { prestataire_id: req.prestataire.id } });

    const [bookingStats] = await sequelize.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
       FROM bookings WHERE prestataire_id = ?`,
      { replacements: [req.prestataire.id] }
    );

    return sendSuccess(res, 200, 'Statistiques récupérées.', {
      stats: {
        view_count:   profile?.view_count || 0,
        bookings:     bookingStats[0] || { total: 0, pending: 0, confirmed: 0, completed: 0 },
        rating_avg:   req.prestataire.rating_avg,
        rating_count: req.prestataire.rating_count,
      },
    });
  } catch (error) { next(error); }
};

module.exports = { getProfiles, getProfileById, upsertProfile, getMyProfile, getProfileStats };
