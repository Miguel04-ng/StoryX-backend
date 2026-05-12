const path = require('path');
const { sequelize, Post, PostMedia, Prestataire, User, Client, Favorite } = require('../models/index');
const { sendSuccess, sendError, getPagination, buildPaginationMeta } = require('../utils/helpers');
const { saveBase64Image } = require('../middleware/upload');

// ── Sauvegarder un media base64 (photo ou vidéo) ─────────────────────────────
const saveMedia = async (base64, prefix, postId) => {
  if (!base64 || typeof base64 !== 'string') return null;
  return await saveBase64Image(base64, `${prefix}_${postId}`);
};

// ── POST /api/posts ───────────────────────────────────────────────────────────
const createPost = async (req, res, next) => {
  try {
    if (req.user.role !== 'PRESTATAIRE') {
      return sendError(res, 403, 'Seuls les prestataires peuvent publier.');
    }

    const { content, medias = [], is_premium_only = false } = req.body;
    // medias = [{ type: 'PHOTO'|'VIDEO', data: base64 }]

    if (!content && medias.length === 0) {
      return sendError(res, 400, 'Ajoutez un texte ou un média.');
    }

    // Déterminer le type du post
    let type = 'TEXT';
    const hasPhotos = medias.some(m => m.type === 'PHOTO');
    const hasVideos = medias.some(m => m.type === 'VIDEO');
    if (hasPhotos && hasVideos) type = 'MIXED';
    else if (hasPhotos) type = 'PHOTO';
    else if (hasVideos) type = 'VIDEO';

    const t = await sequelize.transaction();
    try {
      const post = await Post.create({
        prestataire_id: req.prestataire.id,
        content:        content?.trim() || null,
        type,
        is_premium_only: is_premium_only ? 1 : 0,
        is_approved:     1,
      }, { transaction: t });

      // Sauvegarder les médias
      for (let i = 0; i < medias.length; i++) {
        const m = medias[i];
        const url = await saveMedia(m.data, m.type.toLowerCase(), post.id);
        if (url) {
          // Pour les vidéos, créer une miniature (ici on stocke juste l'URL)
          await PostMedia.create({
            post_id:    post.id,
            type:       m.type,
            url,
            url_blurred: null, // TODO: générer en production
            sort_order: i,
          }, { transaction: t });
        }
      }

      await t.commit();
      const fullPost = await Post.findByPk(post.id, {
        include: [{ model: PostMedia, as: 'media' }],
      });

      return sendSuccess(res, 201, 'Publication créée.', { post: fullPost });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) { next(error); }
};

// ── GET /api/posts?prestataire_id=X ──────────────────────────────────────────
const getPosts = async (req, res, next) => {
  try {
    const { prestataire_id } = req.query;
    const { page, limit, offset } = getPagination(req.query);
    const isPremium = req.isPremium || false;

    const where = { is_approved: 1 };
    if (prestataire_id) where.prestataire_id = parseInt(prestataire_id);

    const { rows: posts, count } = await Post.findAndCountAll({
      where,
      include: [
        { model: PostMedia, as: 'media' },
        { model: Prestataire, as: 'prestataire', attributes: ['id', 'display_name'] },
      ],
      order:    [['created_at', 'DESC']],
      limit, offset, distinct: true,
    });

    // Appliquer les restrictions premium sur les médias
    const result = posts.map(p => {
      const plain = p.toJSON();

      // Post premium_only : masquer le contenu si non-premium
      if (plain.is_premium_only && !isPremium) {
        return {
          ...plain,
          content:    null,
          media:      plain.media.map(m => ({
            ...m,
            url:        m.url_blurred || m.url,
            is_blurred: true,
          })),
          _premium_required: true,
        };
      }

      // Vidéos : floutées si non-premium
      const media = plain.media.map(m => {
        if (m.type === 'VIDEO' && !isPremium) {
          return { ...m, url: m.url_blurred || m.url, is_blurred: true };
        }
        return { ...m, is_blurred: false };
      });

      return { ...plain, media, _premium_required: false };
    });

    return sendSuccess(res, 200, 'Publications récupérées.', {
      posts: result,
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) { next(error); }
};

// ── GET /api/posts/mine ───────────────────────────────────────────────────────
const getMyPosts = async (req, res, next) => {
  try {
    if (req.user.role !== 'PRESTATAIRE') return sendError(res, 403, 'Accès refusé.');
    const { page, limit, offset } = getPagination(req.query);

    const { rows: posts, count } = await Post.findAndCountAll({
      where:   { prestataire_id: req.prestataire.id },
      include: [{ model: PostMedia, as: 'media' }],
      order:   [['created_at', 'DESC']],
      limit, offset, distinct: true,
    });

    return sendSuccess(res, 200, 'Mes publications.', {
      posts,
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) { next(error); }
};

// ── DELETE /api/posts/:id ─────────────────────────────────────────────────────
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return sendError(res, 404, 'Publication introuvable.');

    const isOwner = req.user.role === 'PRESTATAIRE' && post.prestataire_id === req.prestataire?.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return sendError(res, 403, 'Accès refusé.');

    await post.destroy();
    return sendSuccess(res, 200, 'Publication supprimée.');
  } catch (error) { next(error); }
};

// ══════════════════════════════════════════════════════════════
//  FAVORIS
// ══════════════════════════════════════════════════════════════

// ── POST /api/favorites/toggle ────────────────────────────────────────────────
const toggleFavorite = async (req, res, next) => {
  try {
    if (req.user.role !== 'CLIENT') {
      return sendError(res, 403, 'Seuls les clients peuvent gérer leurs favoris.');
    }

    const { prestataire_id } = req.body;
    if (!prestataire_id) return sendError(res, 400, 'prestataire_id requis.');

    const prestataire = await Prestataire.findByPk(prestataire_id);
    if (!prestataire) return sendError(res, 404, 'Prestataire introuvable.');

    // Toggle : si existe → supprimer, sinon → créer
    const existing = await Favorite.findOne({
      where: { client_id: req.client.id, prestataire_id: parseInt(prestataire_id) },
    });

    if (existing) {
      await existing.destroy();
      return sendSuccess(res, 200, 'Retiré des favoris.', { isFavorite: false });
    } else {
      await Favorite.create({
        client_id:      req.client.id,
        prestataire_id: parseInt(prestataire_id),
      });
      return sendSuccess(res, 201, 'Ajouté aux favoris.', { isFavorite: true });
    }
  } catch (error) { next(error); }
};

// ── GET /api/favorites ────────────────────────────────────────────────────────
const getFavorites = async (req, res, next) => {
  try {
    if (req.user.role !== 'CLIENT') return sendError(res, 403, 'Accès refusé.');
    const { page, limit, offset } = getPagination(req.query);

    const { rows: favs, count } = await Favorite.findAndCountAll({
      where: { client_id: req.client.id },
      include: [{
        model: Prestataire,
        as:    'prestataire',
        include: [
          { model: User, as: 'user', attributes: ['id', 'email'] },
          { model: require('./index').Profile, as: 'profile', required: false,
            include: [{ model: require('./index').Photo, as: 'photos',
              where: { is_approved: 1 }, required: false, limit: 1,
              order: [['is_cover', 'DESC']] }] },
        ],
      }],
      order:    [['created_at', 'DESC']],
      limit, offset, distinct: true,
    });

    const isPremium = req.isPremium || false;
    const result = favs.map(f => {
      const plain  = f.toJSON()
      const p      = plain.prestataire
      const photos = p?.profile?.photos || []
      const photo  = photos[0]

      return {
        favorite_id:   plain.id,
        prestataire_id: p?.id,
        display_name:  p?.display_name,
        tarif_min:     p?.tarif_min,
        rating_avg:    p?.rating_avg,
        ville:         p?.profile?.ville,
        cover_photo:   photo ? {
          url:        isPremium ? photo.url : (photo.url_blurred || photo.url),
          is_blurred: !isPremium,
        } : null,
        added_at: plain.created_at,
      };
    });

    return sendSuccess(res, 200, 'Favoris récupérés.', {
      favorites: result,
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) { next(error); }
};

// ── GET /api/favorites/check/:prestataireId ───────────────────────────────────
const checkFavorite = async (req, res, next) => {
  try {
    if (req.user.role !== 'CLIENT') {
      return res.json({ success: true, isFavorite: false });
    }
    const existing = await Favorite.findOne({
      where: { client_id: req.client.id, prestataire_id: parseInt(req.params.prestataireId) },
    });
    return sendSuccess(res, 200, 'Statut favori.', { isFavorite: !!existing });
  } catch (error) { next(error); }
};

// Incrémenter les vues des vidéos
const incrementPostView = async (req, res, next) =>{
  try{
    const {id} = req.params;
    await Post.increment('views_count', {where: {id}});
    return sendSuccess(res, 200, 'Vue enregistrée');
  }catch (error) {next(error);}
}

module.exports = {
  createPost, getPosts, getMyPosts, deletePost,
  toggleFavorite, getFavorites, checkFavorite, incrementPostView,
};
