const bcrypt  = require('bcryptjs');
const { User, Client, Prestataire, Admin } = require('../models/index');
const { generateToken, sendSuccess, sendError } = require('../utils/helpers');

// ── POST /api/auth/register ───────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const {
      email, password, first_name, last_name,
      role = 'CLIENT', phone, date_naissance,
      // Prestataire uniquement
      photo_profil,   // base64 photo visage
      photo_identite, // base64 pièce d'identité
    } = req.body;

    const exists = await User.findOne({ where: { email } });
    if (exists) return sendError(res, 409, 'Un compte avec cet email existe déjà.');

    // Validation photos prestataire
    const roleUp = role.toUpperCase();
    if (roleUp === 'PRESTATAIRE') {
      const { isValidBase64Image } = require('../middleware/upload');
      if (!photo_profil   || !isValidBase64Image(photo_profil)) {
        return sendError(res, 422, 'La photo de profil est requise pour les prestataires (image base64).');
      }
      if (!photo_identite || !isValidBase64Image(photo_identite)) {
        return sendError(res, 422, "La photo de pièce d'identité est requise pour les prestataires (image base64).");
      }
    }

    const hashed = await bcrypt.hash(password, 12);
    const { sequelize } = require('../models/index');
    const t = await sequelize.transaction();

    try {
      // Les prestataires démarrent is_active=0 jusqu'à validation admin
      const user = await User.create({
        email,
        password:   hashed,
        role:       roleUp,
        is_active:  roleUp === 'PRESTATAIRE' ? 0 : 1,
      }, { transaction: t });

      if (roleUp === 'CLIENT') {
        await Client.create({
          user_id: user.id,
          first_name: first_name || email.split('@')[0],
          last_name:  last_name  || '',
          phone:      phone || null,
        }, { transaction: t });
      } else if (roleUp === 'PRESTATAIRE') {
        const { saveBase64Image } = require('../middleware/upload');
        const photoProfilUrl   = await saveBase64Image(photo_profil,   `profil_${user.id}`);
        const photoIdentiteUrl = await saveBase64Image(photo_identite, `identite_${user.id}`);

        const prest = await Prestataire.create({
          user_id:      user.id,
          display_name: `${first_name} ${last_name}`.trim(),
          is_verified:  0,
          is_premium:   0,
        }, { transaction: t });

        // Stocker les URLs dans le profile
        await require('../models/index').Profile.create({
          prestataire_id: prest.id,
          // On stocke les URLs docs dans un champ JSON custom (disponibilites sert de placeholder ici)
          // En prod, créer une table documents
        }, { transaction: t });

        // Stocker les photos dans audit_logs temporairement (ou table documents dédiée)
        await require('../models/index').AuditLog.create({
          user_id:     user.id,
          action:      'prestataire.inscription',
          entity_type: 'prestataires',
          entity_id:   prest.id,
          new_values:  {
            photo_profil_url:   photoProfilUrl,
            photo_identite_url: photoIdentiteUrl,
            first_name, last_name, phone,
          },
        }, { transaction: t });
      }

      await t.commit();

      if (roleUp === 'PRESTATAIRE') {
        // Pas de token — compte en attente de validation
        return sendSuccess(res, 201, 'Demande envoyée. Votre dossier est en cours de vérification. Vous serez notifié(e) par email dès validation.', {
          pending: true,
          user: { id: user.id, email: user.email, role: user.role },
        });
      }

      const token = generateToken(user.id);
      return sendSuccess(res, 201, 'Inscription réussie. Bienvenue sur StoryX !', {
        token,
        user: {
          id: user.id, email: user.email, role: user.role,
          first_name, last_name, is_premium: false,
        },
      });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email, deleted_at: null },
      include: [
        { model: Client,      as: 'client',      required: false },
        { model: Prestataire, as: 'prestataire',  required: false },
      ],
    });

    if (!user) return sendError(res, 401, 'Email ou mot de passe incorrect.');
    console.log('IS_ACTIVE:', user.is_active)
    if (!user.is_active) return sendError(res, 401, 'Compte désactivé. Contactez le support.');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return sendError(res, 401, 'Email ou mot de passe incorrect.');

    // Mettre à jour last_login_at
    await user.update({ last_login_at: new Date() });

    const isPremium = user.role === 'CLIENT'
      ? (user.client?.is_premium === 1)
      : (user.prestataire?.is_premium === 1);

    const token = generateToken(user.id);

    return sendSuccess(res, 200, 'Connexion réussie.', {
      token,
      user: {
        id:           user.id,
        email:        user.email,
        role:         user.role,
        first_name:   user.client?.first_name || user.prestataire?.display_name?.split(' ')[0] || '',
        display_name: user.prestataire?.display_name || null,
        is_premium:   isPremium,
        is_verified:  user.prestataire?.is_verified || false,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = (req, res) => {
  const u = req.user;
  return sendSuccess(res, 200, 'Profil récupéré.', {
    user: {
      id:           u.id,
      email:        u.email,
      role:         u.role,
      first_name:   u.client?.first_name || '',
      last_name:    u.client?.last_name  || '',
      display_name: u.prestataire?.display_name || null,
      is_premium:   req.isPremium,
      is_verified:  u.prestataire?.is_verified || false,
    },
  });
};

module.exports = { register, login, getMe };
