const { Op } = require('sequelize');
const {
  sequelize, Booking, Client, Prestataire,
  Conversation, Message, Review, Payment, Subscription, User,
} = require('../models/index');
const {
  sendSuccess, sendError, getPagination, buildPaginationMeta, generateReference,
} = require('../utils/helpers');
const {
  checkAndIncrementRequest,
  checkAndIncrementMessage,
  activatePremium,
} = require('../services/premiumService');
const cinetpay    = require('../services/cinetpayService');
const flutterwave = require('../services/flutterwaveService');

// ══════════════════════════════════════════════════════════════
//  HELPERS MÉDIAS — logique de floutage
// ══════════════════════════════════════════════════════════════

/**
 * Applique la logique freemium aux photos :
 * - 3 premières photos : toujours visibles (url réelle)
 * - À partir de la 4e : floutées si non-premium
 */
const applyPhotoAccess = (photos = [], isPremium = false) => {
  return photos.map((ph, index) => {
    const isFree = index < 3;      // Les 3 premières sont toujours visibles
    const show   = isFree || isPremium;
    return {
      id:         ph.id,
      url:        show ? ph.url : (ph.url_blurred || ph.url),
      is_blurred: !show,
      is_cover:   ph.is_cover,
      sort_order: ph.sort_order,
    };
  });
};

// ══════════════════════════════════════════════════════════════
//  BOOKINGS
// ══════════════════════════════════════════════════════════════

const createBooking = async (req, res, next) => {
  try {
    // ⛔ Seuls les clients peuvent réserver
    if (req.user.role !== 'CLIENT') {
      return sendError(res, 403, 'Seuls les clients peuvent effectuer des réservations. Les prestataires ne peuvent pas réserver.');
    }

    // Vérification limite freemium
    const check = await checkAndIncrementRequest(req.user.id, req.isPremium);
    if (!check.allowed) {
      return res.status(403).json({
        success: false,
        message: check.message,
        requiresPremium: true,
        upgradeUrl: '/subscribe',
        demandesRestantes: 0,
      });
    }

    const { prestataire_id, booking_date, amount, location, note_client, duration_hours } = req.body;

    const prestataire = await Prestataire.findByPk(prestataire_id, {
      include: [{ model: User, as: 'user', where: { is_active: 1 } }],
    });
    if (!prestataire) return sendError(res, 404, 'Prestataire introuvable.');

    const commissionRate = 15.00;
    const commissionAmt  = parseFloat(((amount || 0) * commissionRate / 100).toFixed(2));

    const booking = await Booking.create({
      client_id:       req.client.id,
      prestataire_id:  prestataire.id,
      booking_date:    new Date(booking_date),
      amount:          parseFloat(amount || 0),
      commission_rate: commissionRate,
      commission_amt:  commissionAmt,
      location:        location || null,
      note_client:     note_client || null,
      duration_hours:  duration_hours || null,
    });

    return sendSuccess(res, 201, 'Réservation envoyée. En attente de confirmation du prestataire.', {
      booking,
      demandesRestantes: check.remaining,
    });
  } catch (error) { next(error); }
};

const getBookings = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;
    const where = {};

    if (req.user.role === 'CLIENT')      where.client_id      = req.client.id;
    if (req.user.role === 'PRESTATAIRE') where.prestataire_id = req.prestataire.id;
    if (status) where.status = status;

    const { rows: bookings, count } = await Booking.findAndCountAll({
      where,
      include: [
        { model: Client,      as: 'client',      include: [{ model: User, as: 'user', attributes: ['email'] }] },
        { model: Prestataire, as: 'prestataire',  include: [{ model: User, as: 'user', attributes: ['email'] }] },
      ],
      order: [['created_at', 'DESC']],
      limit, offset, distinct: true,
    });

    return sendSuccess(res, 200, 'Réservations récupérées.', {
      bookings,
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) { next(error); }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    const { id }            = req.params;
    const { action, motif } = req.body;

    const booking = await Booking.findByPk(id, {
      include: [
        { model: Client,      as: 'client' },
        { model: Prestataire, as: 'prestataire' },
      ],
    });

    if (!booking) return sendError(res, 404, 'Réservation introuvable.');

    const isClient      = req.user.role === 'CLIENT'      && booking.client_id      === req.client?.id;
    const isPrestataire = req.user.role === 'PRESTATAIRE' && booking.prestataire_id === req.prestataire?.id;
    const isAdmin       = req.user.role === 'ADMIN';

    if (!isClient && !isPrestataire && !isAdmin) return sendError(res, 403, 'Accès refusé.');

    const transitions = {
      confirm:  { from: ['PENDING'],             newStatus: 'CONFIRMED',               field: 'confirmed_at', allowedRoles: ['PRESTATAIRE', 'ADMIN'] },
      cancel:   { from: ['PENDING','CONFIRMED'],  newStatus: isClient ? 'CANCELLED_CLIENT' : 'CANCELLED_PRESTATAIRE', field: 'cancelled_at', allowedRoles: ['CLIENT','PRESTATAIRE','ADMIN'] },
      complete: { from: ['CONFIRMED'],            newStatus: 'COMPLETED',               field: 'completed_at', allowedRoles: ['PRESTATAIRE','ADMIN'] },
    };

    const transition = transitions[action];
    if (!transition) return sendError(res, 400, `Action invalide : ${action}`);
    if (!transition.from.includes(booking.status)) {
      return sendError(res, 400, `Impossible d'effectuer "${action}" sur une réservation "${booking.status}".`);
    }
    if (!transition.allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, `Action "${action}" non autorisée pour votre rôle.`);
    }

    await booking.update({ status: transition.newStatus, [transition.field]: new Date() });
    return sendSuccess(res, 200, 'Réservation mise à jour.', { booking });
  } catch (error) { next(error); }
};

// ══════════════════════════════════════════════════════════════
//  MESSAGES
// ══════════════════════════════════════════════════════════════

const sendMessage = async (req, res, next) => {
  try {
    // ⛔ RÈGLE MÉTIER : seuls les clients peuvent INITIER/ENVOYER
    if (req.user.role === 'PRESTATAIRE') {
      return sendError(res, 403,
        'Les prestataires ne peuvent pas envoyer de messages. Attendez qu\'un client vous contacte.'
      );
    }

    if (req.user.role !== 'CLIENT') {
      return sendError(res, 403, 'Action réservée aux clients.');
    }

    // ✅ Vérification limite messages (10 pour gratuit)
    const msgCheck = await checkAndIncrementMessage(req.user.id, req.isPremium);
    if (!msgCheck.allowed) {
      return res.status(403).json({
        success:         false,
        message:         msgCheck.message,
        requiresPremium: true,
        upgradeUrl:      '/subscribe',
        messagesRestants: 0,
      });
    }

    const { content, prestataire_id } = req.body;

    if (!prestataire_id) return sendError(res, 400, 'prestataire_id requis.');

    const clientId      = req.client.id;
    const prestataireId = parseInt(prestataire_id);

    // Vérifier que le prestataire existe
    const prestataire = await Prestataire.findByPk(prestataireId);
    if (!prestataire) return sendError(res, 404, 'Prestataire introuvable.');

    // Trouver ou créer la conversation
    const [conversation] = await Conversation.findOrCreate({
      where:    { client_id: clientId, prestataire_id: prestataireId },
      defaults: { client_id: clientId, prestataire_id: prestataireId },
    });

    const message = await Message.create({
      conversation_id: conversation.id,
      sender_user_id:  req.user.id,
      content,
      type: 'TEXT',
    });

    await conversation.update({ last_message_at: new Date() });
    await message.reload({
      include: [{ model: User, as: 'sender', attributes: ['id', 'email', 'role'] }],
    });

    return sendSuccess(res, 201, 'Message envoyé.', {
      message,
      messagesRestants: msgCheck.remaining,
    });
  } catch (error) { next(error); }
};

// ── Réponse d'un prestataire dans une conversation existante ──────────────────
const replyMessage = async (req, res, next) => {
  try {
    // Un prestataire peut RÉPONDRE dans une conversation déjà ouverte par un client
    if (req.user.role !== 'PRESTATAIRE' && req.user.role !== 'CLIENT') {
      return sendError(res, 403, 'Action non autorisée.');
    }

    const { conversation_id, content } = req.body;

    const conv = await Conversation.findByPk(conversation_id);
    if (!conv) return sendError(res, 404, 'Conversation introuvable.');

    // Vérifier que l'utilisateur appartient à cette conversation
    const hasAccess = (req.user.role === 'CLIENT'      && conv.client_id      === req.client?.id)
                   || (req.user.role === 'PRESTATAIRE' && conv.prestataire_id === req.prestataire?.id);

    if (!hasAccess) return sendError(res, 403, 'Accès refusé à cette conversation.');

    // Limite messages pour les clients seulement
    if (req.user.role === 'CLIENT') {
      const msgCheck = await checkAndIncrementMessage(req.user.id, req.isPremium);
      if (!msgCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: msgCheck.message,
          requiresPremium: true,
          upgradeUrl: '/subscribe',
        });
      }
    }

    const message = await Message.create({
      conversation_id,
      sender_user_id: req.user.id,
      content,
      type: 'TEXT',
    });

    await conv.update({ last_message_at: new Date() });
    await message.reload({
      include: [{ model: User, as: 'sender', attributes: ['id', 'email', 'role'] }],
    });

    return sendSuccess(res, 201, 'Message envoyé.', { message });
  } catch (error) { next(error); }
};

const getConversations = async (req, res, next) => {
  try {
    let where;

    if (req.user.role === 'CLIENT') {
      where = { client_id: req.client.id };
    } else if (req.user.role === 'PRESTATAIRE') {
      where = { prestataire_id: req.prestataire.id };
    } else {
      where = {}; // Admin voit tout
    }

    const conversations = await Conversation.findAll({
      where,
      include: [
        { model: Client,      as: 'client',      include: [{ model: User, as: 'user', attributes: ['id', 'email'] }] },
        { model: Prestataire, as: 'prestataire',  include: [{ model: User, as: 'user', attributes: ['id', 'email'] }] },
      ],
      order: [['last_message_at', 'DESC']],
      limit: 50,
    });

    const enriched = await Promise.all(conversations.map(async (conv) => {
      const [lastMessage, unreadCount] = await Promise.all([
        Message.findOne({
          where:   { conversation_id: conv.id, deleted_at: null },
          order:   [['sent_at', 'DESC']],
          include: [{ model: User, as: 'sender', attributes: ['id', 'role'] }],
        }),
        Message.count({
          where: {
            conversation_id: conv.id,
            is_read:         0,
            sender_user_id:  { [Op.ne]: req.user.id },
          },
        }),
      ]);
      return { ...conv.toJSON(), lastMessage, unreadCount };
    }));

    return sendSuccess(res, 200, 'Conversations récupérées.', { conversations: enriched });
  } catch (error) { next(error); }
};

const getConversationMessages = async (req, res, next) => {
  try {
    const convId = parseInt(req.params.conversationId);
    const { page, limit, offset } = getPagination(req.query);

    const conv = await Conversation.findByPk(convId);
    if (!conv) return sendError(res, 404, 'Conversation introuvable.');

    const hasAccess = (req.user.role === 'CLIENT'      && conv.client_id      === req.client?.id)
                   || (req.user.role === 'PRESTATAIRE' && conv.prestataire_id === req.prestataire?.id)
                   || req.user.role === 'ADMIN';

    if (!hasAccess) return sendError(res, 403, 'Accès refusé.');

    const { rows: messages, count } = await Message.findAndCountAll({
      where:   { conversation_id: convId, deleted_at: null },
      include: [{ model: User, as: 'sender', attributes: ['id', 'email', 'role'] }],
      order:   [['sent_at', 'DESC']],
      limit, offset,
    });

    // Marquer comme lus
    await Message.update(
      { is_read: 1, read_at: new Date() },
      { where: { conversation_id: convId, sender_user_id: { [Op.ne]: req.user.id }, is_read: 0 } }
    );

    return sendSuccess(res, 200, 'Messages récupérés.', {
      messages:   messages.reverse(),
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) { next(error); }
};

const getUnreadCount = async (req, res, next) => {
  try {
    let convWhere;
    if (req.user.role === 'CLIENT')      convWhere = { client_id: req.client?.id };
    else if (req.user.role === 'PRESTATAIRE') convWhere = { prestataire_id: req.prestataire?.id };
    else convWhere = {};

    const count = await Message.count({
      where: { sender_user_id: { [Op.ne]: req.user.id }, is_read: 0, deleted_at: null },
      include: [{
        model:    Conversation,
        as:       'conversation',
        where:    convWhere,
        required: true,
      }],
    });

    return sendSuccess(res, 200, 'Messages non lus.', { unreadCount: count });
  } catch (error) { next(error); }
};

// ══════════════════════════════════════════════════════════════
//  REVIEWS
// ══════════════════════════════════════════════════════════════

const createReview = async (req, res, next) => {
  try {
    if (req.user.role !== 'CLIENT') {
      return sendError(res, 403, 'Seuls les clients peuvent laisser un avis.');
    }

    const { booking_id, rating, comment } = req.body;

    const booking = await Booking.findOne({
      where: { id: booking_id, client_id: req.client.id, status: 'COMPLETED' },
    });

    if (!booking) {
      return sendError(res, 403, 'Vous devez avoir une réservation terminée pour laisser un avis.');
    }

    const existing = await Review.findOne({ where: { booking_id } });
    if (existing) return sendError(res, 409, 'Un avis existe déjà pour cette réservation.');

    const review = await Review.create({
      booking_id,
      client_id:      req.client.id,
      prestataire_id: booking.prestataire_id,
      rating:         parseInt(rating),
      comment:        comment?.trim() || null,
      is_approved:    0,
    });

    return sendSuccess(res, 201, 'Avis soumis. Il sera visible après modération.', { review });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, 409, 'Un avis existe déjà pour cette réservation.');
    }
    next(error);
  }
};

const getProviderReviews = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const prestataireId = parseInt(req.params.prestataireId);

    const { rows: reviews, count } = await Review.findAndCountAll({
      where:    { prestataire_id: prestataireId, is_approved: 1, is_flagged: 0 },
      include:  [{ model: Client, as: 'client', include: [{ model: User, as: 'user', attributes: ['email'] }] }],
      order:    [['created_at', 'DESC']],
      limit, offset, distinct: true,
    });

    const prest = await Prestataire.findByPk(prestataireId, {
      attributes: ['rating_avg', 'rating_count'],
    });

    const [distRows] = await sequelize.query(
      `SELECT rating, COUNT(*) AS count FROM reviews
       WHERE prestataire_id = ? AND is_approved = 1
       GROUP BY rating ORDER BY rating DESC`,
      { replacements: [prestataireId] }
    );

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distRows.forEach(r => { distribution[r.rating] = parseInt(r.count); });

    return sendSuccess(res, 200, 'Avis récupérés.', {
      reviews,
      stats: {
        averageRating: parseFloat(prest?.rating_avg || 0),
        totalReviews:  prest?.rating_count || 0,
        distribution,
      },
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) { next(error); }
};

// ══════════════════════════════════════════════════════════════
//  PAYMENTS
// ══════════════════════════════════════════════════════════════

const TARIFS = {
  CLIENT:      { 1: 5000,  3: 12000, 6: 22000, 12: 40000 },
  PRESTATAIRE: { 1: 10000, 3: 25000, 6: 45000, 12: 80000 },
};

const getTarifs = (req, res) => {
  const role   = req.user.role;
  const tarifs = TARIFS[role] || TARIFS.CLIENT;
  return sendSuccess(res, 200, 'Tarifs Premium.', {
    role,
    currency: 'FCFA',
    tarifs: Object.entries(tarifs).map(([mois, prix]) => ({
      duree_mois:  parseInt(mois),
      label:       mois === '12' ? '1 an' : `${mois} mois`,
      prix,
      prix_mensuel: Math.round(prix / parseInt(mois)),
    })),
    providers: {
      cinetpay:    { methods: ['MTN_MOMO', 'ORANGE_MONEY', 'MOBILE_MONEY', 'CARD', 'WAVE'] },
      flutterwave: { methods: ['MTN_MOMO', 'ORANGE_MONEY', 'CARD'] },
    },
  });
};

const initiatePayment = async (req, res, next) => {
  try {
    const { provider = 'cinetpay', method = 'MTN_MOMO', duree_mois = 1, phone } = req.body;

    if (req.user.role === 'ADMIN') {
      return sendError(res, 403, "Les administrateurs n'ont pas besoin d'abonnement.");
    }

    const amount = TARIFS[req.user.role]?.[parseInt(duree_mois)];
    if (!amount) return sendError(res, 400, `Durée invalide : ${duree_mois} mois`);

    const reference = generateReference();

    const payment = await Payment.create({
      payer_user_id:    req.user.id,
      amount,
      currency:         'FCFA',
      method:           method.toUpperCase(),
      status:           'PENDING',
      provider:         provider.toLowerCase(),
      storyx_reference: reference,
      duree_mois:       parseInt(duree_mois),
    });

    const backendUrl  = process.env.BACKEND_URL  || 'http://localhost:5000';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const customer = {
      id:      req.user.id.toString(),
      name:    req.client?.first_name || req.prestataire?.display_name?.split(' ')[0] || 'Client',
      surname: req.client?.last_name  || '',
      email:   req.user.email,
      phone:   phone || '',
      country: 'CM',
    };

    let result;
    try {
      if (provider === 'cinetpay') {
        result = await cinetpay.initiatePayment({
          reference, amount, currency: 'XAF',
          description: `StoryX Premium — ${duree_mois} mois`,
          customer,
          notifyUrl:  `${backendUrl}/api/payments/webhook/cinetpay`,
          returnUrl:  `${frontendUrl}/payment/success?ref=${reference}`,
          cancelUrl:  `${frontendUrl}/payment/cancel?ref=${reference}`,
        });
      } else {
        result = await flutterwave.initiatePayment({
          reference, amount, currency: 'XAF', method,
          customer,
          redirectUrl: `${frontendUrl}/payment/success?ref=${reference}`,
          description: `StoryX Premium — ${duree_mois} mois`,
        });
      }
    } catch (err) {
      await payment.update({ status: 'FAILED', provider_raw: { error: err.message } });
      return sendError(res, 503, `Service de paiement indisponible : ${err.message}`);
    }

    await payment.update({ payment_url: result.paymentUrl });

    return sendSuccess(res, 200, 'Paiement initié.', {
      paymentUrl: result.paymentUrl,
      reference,
      paymentId:  payment.id,
      amount,
      currency:   'FCFA',
      provider,
    });
  } catch (error) { next(error); }
};

const handleWebhook = async (req, res, next) => {
  const provider = req.params.provider;
  res.status(200).json({ received: true });

  try {
    let parsed, isSignatureValid;

    if (provider === 'cinetpay') {
      isSignatureValid = cinetpay.verifyWebhookSignature(req.body);
      parsed = cinetpay.parseWebhookPayload(req.body);
    } else if (provider === 'flutterwave') {
      isSignatureValid = flutterwave.verifyWebhookSignature(req.headers['verif-hash']);
      parsed = flutterwave.parseWebhookPayload(req.body);
    } else return;

    if (!isSignatureValid) return console.error(`❌ Signature invalide webhook ${provider}`);

    const payment = await Payment.findOne({ where: { storyx_reference: parsed.reference } });
    if (!payment) return console.error(`❌ Payment introuvable : ${parsed.reference}`);
    if (payment.status === 'SUCCESS') return;

    let verified;
    try {
      if (provider === 'cinetpay') {
        verified = await cinetpay.verifyTransaction(parsed.transactionId || parsed.reference);
        verified.isSuccess = verified.status === 'ACCEPTED';
      } else {
        verified = await flutterwave.verifyTransaction(parsed.transactionId);
      }
    } catch (e) {
      verified = { isSuccess: parsed.isSuccess, transactionId: parsed.transactionId };
    }

    if (verified.isSuccess || parsed.isSuccess) {
      await payment.update({ status: 'SUCCESS', provider_ref: parsed.transactionId, provider_raw: req.body, paid_at: new Date() });
      const subscription = await activatePremium(payment.payer_user_id, {
        montant: payment.amount, methodePaiement: payment.method,
        dureeMois: payment.duree_mois, transactionRef: payment.storyx_reference,
      });
      await payment.update({ subscription_id: subscription.id });
      console.log(`✅ Premium activé : userId=${payment.payer_user_id}`);
    } else {
      await payment.update({ status: 'FAILED', provider_raw: req.body });
    }
  } catch (error) {
    console.error(`❌ Erreur webhook ${provider} :`, error.message);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      where: { storyx_reference: req.params.reference },
      attributes: { exclude: ['provider_raw'] },
    });

    if (!payment) return sendError(res, 404, 'Paiement introuvable.');
    if (payment.payer_user_id !== req.user.id) return sendError(res, 403, 'Accès refusé.');

    const message = payment.status === 'SUCCESS'
      ? 'Paiement confirmé. Votre accès Premium est actif.'
      : payment.status === 'FAILED' ? 'Paiement échoué.' : 'Paiement en cours.';

    return sendSuccess(res, 200, message, { payment, isPremiumActive: payment.status === 'SUCCESS' });
  } catch (error) { next(error); }
};

const getPaymentHistory = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { rows: payments, count } = await Payment.findAndCountAll({
      where:    { payer_user_id: req.user.id },
      attributes: { exclude: ['provider_raw'] },
      order:    [['created_at', 'DESC']],
      limit, offset,
    });

    return sendSuccess(res, 200, 'Historique des paiements.', {
      payments,
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) { next(error); }
};

module.exports = {
  createBooking, getBookings, updateBookingStatus,
  sendMessage, replyMessage, getConversations, getConversationMessages, getUnreadCount,
  createReview, getProviderReviews,
  getTarifs, initiatePayment, handleWebhook, verifyPayment, getPaymentHistory,
  applyPhotoAccess,
};
