const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/helpers');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(
      res, 422,
      'Données invalides.',
      errors.array().map(e => ({ champ: e.path, message: e.msg }))
    );
  }
  next();
};

const registerRules = [
  body('email').trim().notEmpty().isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('8 caractères minimum')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('1 majuscule, 1 minuscule, 1 chiffre requis'),
  body('first_name').trim().notEmpty().withMessage('Prénom requis'),
  body('last_name').trim().notEmpty().withMessage('Nom requis'),
  body('role').optional().isIn(['CLIENT', 'PRESTATAIRE']).withMessage('Rôle invalide'),
  body('date_naissance').notEmpty().withMessage('Date de naissance requise').isISO8601()
    .custom(val => {
      const age = Math.floor((Date.now() - new Date(val)) / (365.25 * 24 * 3600 * 1000));
      if (age < 21) throw new Error('Vous devez avoir au moins 21 ans pour vous inscrire sur StoryX');
      return true;
    }),
];

const loginRules = [
  body('email').trim().notEmpty().isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Mot de passe requis'),
];

const bookingRules = [
  body('prestataire_id').notEmpty().isInt({ min: 1 }).withMessage('Prestataire requis'),
  body('booking_date').notEmpty().isISO8601().withMessage('Date invalide')
    .custom(val => { if (new Date(val) <= new Date()) throw new Error('Date doit être future'); return true; }),
  body('amount').notEmpty().isFloat({ min: 0 }).withMessage('Montant invalide'),
];

const messageRules = [
  body('prestataire_id').optional().isInt({ min: 1 }),
  body('client_id').optional().isInt({ min: 1 }),
  body('content').trim().notEmpty().withMessage('Message vide').isLength({ max: 5000 }),
];

const reviewRules = [
  body('booking_id').notEmpty().isInt({ min: 1 }).withMessage('Réservation requise'),
  body('rating').notEmpty().isInt({ min: 1, max: 5 }).withMessage('Note entre 1 et 5'),
  body('comment').optional().trim().isLength({ max: 1000 }),
];

const paymentInitiateRules = [
  body('provider').optional().isIn(['cinetpay', 'flutterwave']),
  body('method').optional().isIn(['MOBILE_MONEY', 'ORANGE_MONEY', 'MTN_MOMO', 'CARD', 'WAVE']),
  body('duree_mois').optional().isInt({ min: 1, max: 12 }),
  body('phone').optional().isMobilePhone().withMessage('Téléphone invalide'),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  bookingRules,
  messageRules,
  reviewRules,
  paymentInitiateRules,
};
