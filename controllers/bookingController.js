const { sequelize, Booking, Client, Prestataire, Payment, PayoutRequest, User, Conversation } = require('../models/index');
const { sendSuccess, sendError, getPagination, buildPaginationMeta, generateReference } = require('../utils/helpers');
const { checkAndIncrementRequest } = require('../services/premiumService');
const cinetpay   = require('../services/cinetpayService');
const flutterwave = require('../services/flutterwaveService');

const COMMISSION_PCT = 20.00; // 20% pour la plateforme

// ── POST /api/bookings ────────────────────────────────────────────────────────
// Crée la réservation ET initie le paiement obligatoire
const createBooking = async (req, res, next) => {
  try {
    if (req.user.role !== 'CLIENT') {
      return sendError(res, 403, 'Seuls les clients peuvent effectuer des réservations.');
    }

    // Vérification limite freemium
    const check = await checkAndIncrementRequest(req.user.id, req.isPremium);
    if (!check.allowed) {
      return res.status(403).json({
        success:         false,
        message:         check.message,
        requiresPremium: true,
        upgradeUrl:      '/subscribe',
        demandesRestantes: 0,
      });
    }

    const {
      prestataire_id, booking_date, amount, location,
      note_client, duration_hours,
      provider = 'cinetpay', method = 'MTN_MOMO', phone,
    } = req.body;

    if (!prestataire_id) return sendError(res, 400, 'Prestataire requis.');
    if (!booking_date)   return sendError(res, 400, 'Date de réservation requise.');
    if (!amount || parseFloat(amount) <= 0) return sendError(res, 400, 'Montant invalide.');
    if (!location)       return sendError(res, 400, 'Lieu de rendez-vous requis.');

    const prestataire = await Prestataire.findByPk(prestataire_id, {
      include: [{ model: User, as: 'user', where: { is_active: 1 } }],
    });
    if (!prestataire) return sendError(res, 404, 'Prestataire introuvable.');

    const montant        = parseFloat(amount);
    const commissionAmt  = parseFloat((montant * COMMISSION_PCT / 100).toFixed(2));
    const payoutAmt      = parseFloat((montant - commissionAmt).toFixed(2));
    const reference      = generateReference();

    const t = await sequelize.transaction();
    try {
      // 1. Créer la réservation (PENDING, UNPAID)
      const booking = await Booking.create({
        client_id:       req.client.id,
        prestataire_id:  prestataire.id,
        booking_date:    new Date(booking_date),
        amount:          montant,
        commission_rate: COMMISSION_PCT,
        commission_amt:  commissionAmt,
        location:        location,
        note_client:     note_client || null,
        duration_hours:  duration_hours || null,
        status:          'PENDING',
        payment_status:  'UNPAID',
      }, { transaction: t });

      // 2. Créer le Payment{PENDING}
      const payment = await Payment.create({
        booking_id:       booking.id,
        payer_user_id:    req.user.id,
        amount:           montant,
        currency:         'FCFA',
        method:           method.toUpperCase(),
        status:           'PENDING',
        provider:         provider.toLowerCase(),
        storyx_reference: reference,
        duree_mois:       0, // c'est une réservation, pas un abonnement
      }, { transaction: t });

      // 3. Créer le PayoutRequest (reversement dû à la prestataire)
      await PayoutRequest.create({
        booking_id:     booking.id,
        prestataire_id: prestataire.id,
        amount_total:   montant,
        commission_pct: COMMISSION_PCT,
        commission_amt: commissionAmt,
        payout_amt:     payoutAmt,
        status:         'PENDING',
      }, { transaction: t });

      await t.commit();

      // 4. Initier le paiement auprès du fournisseur
      const backendUrl  = process.env.BACKEND_URL  || 'http://localhost:5000';
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      const customer = {
        id:      req.user.id.toString(),
        name:    req.client?.first_name || 'Client',
        surname: req.client?.last_name  || '',
        email:   req.user.email,
        phone:   phone || '',
        country: 'CM',
      };

      let paymentUrl = null;
      try {
        let result;
        if (provider === 'cinetpay') {
          result = await cinetpay.initiatePayment({
            reference, amount: montant, currency: 'XAF',
            description: `Réservation StoryX — ${prestataire.display_name}`,
            customer,
            notifyUrl:  `${backendUrl}/api/bookings/webhook/${provider}`,
            returnUrl:  `${frontendUrl}/payment/success?ref=${reference}&type=booking`,
            cancelUrl:  `${frontendUrl}/payment/cancel?ref=${reference}`,
          });
        } else {
          result = await flutterwave.initiatePayment({
            reference, amount: montant, currency: 'XAF', method,
            customer,
            redirectUrl: `${frontendUrl}/payment/success?ref=${reference}&type=booking`,
            description: `Réservation StoryX — ${prestataire.display_name}`,
          });
        }
        paymentUrl = result.paymentUrl;
        await payment.update({ payment_url: paymentUrl });
      } catch (err) {
        await payment.update({ status: 'FAILED', provider_raw: { error: err.message } });
        // On garde quand même la réservation créée mais sans URL de paiement
        console.error('Erreur paiement réservation:', err.message);
      }

      return sendSuccess(res, 201, 'Réservation créée. Procédez au paiement pour confirmer.', {
        booking: {
          id:            booking.id,
          prestataire:   prestataire.display_name,
          booking_date:  booking.booking_date,
          location:      booking.location,
          amount:        montant,
          commission:    commissionAmt,
          your_part:     payoutAmt,
          status:        'PENDING',
          payment_status: 'UNPAID',
        },
        payment: {
          reference,
          paymentUrl,
          amount: montant,
          currency: 'FCFA',
        },
        demandesRestantes: check.remaining,
      });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) { next(error); }
};

// ── Webhook paiement réservation ──────────────────────────────────────────────
const handleBookingWebhook = async (req, res, next) => {
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

    if (!isSignatureValid) return console.error('❌ Signature invalide booking webhook');

    const payment = await Payment.findOne({
      where: { storyx_reference: parsed.reference },
      include: [{ model: Booking, as: 'booking' }],
    });
    if (!payment || payment.status === 'SUCCESS') return;

    // Vérification auprès du fournisseur
    let verified;
    try {
      if (provider === 'cinetpay') {
        verified = await cinetpay.verifyTransaction(parsed.transactionId || parsed.reference);
        verified.isSuccess = verified.status === 'ACCEPTED';
      } else {
        verified = await flutterwave.verifyTransaction(parsed.transactionId);
      }
    } catch (e) {
      verified = { isSuccess: parsed.isSuccess };
    }

    if (verified.isSuccess || parsed.isSuccess) {
      // Paiement confirmé → activer la réservation
      await payment.update({ status: 'SUCCESS', provider_ref: parsed.transactionId, paid_at: new Date() });

      if (payment.booking) {
        await payment.booking.update({
          status:         'CONFIRMED',
          payment_status: 'PAID',
          confirmed_at:   new Date(),
          payment_id:     payment.id,
        });
      }

      console.log(`✅ Réservation payée : ref=${parsed.reference}`);
    } else {
      await payment.update({ status: 'FAILED' });
    }
  } catch (error) {
    console.error('❌ Erreur webhook booking:', error.message);
  }
};

// ── GET /api/bookings ─────────────────────────────────────────────────────────
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
        { model: Payment,     as: 'payment',      attributes: ['status', 'storyx_reference', 'payment_url'], required: false },
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

// ── PATCH /api/bookings/:id/status ────────────────────────────────────────────
const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, motif } = req.body;

    const booking = await Booking.findByPk(id, {
      include: [
        { model: Client,      as: 'client' },
        { model: Prestataire, as: 'prestataire' },
        { model: Payment,     as: 'payment', required: false },
      ],
    });
    if (!booking) return sendError(res, 404, 'Réservation introuvable.');

    const isClient      = req.user.role === 'CLIENT'      && booking.client_id      === req.client?.id;
    const isPrestataire = req.user.role === 'PRESTATAIRE' && booking.prestataire_id === req.prestataire?.id;
    const isAdmin       = req.user.role === 'ADMIN';

    if (!isClient && !isPrestataire && !isAdmin) return sendError(res, 403, 'Accès refusé.');

    // Vérifier que la réservation est payée avant confirmation prestataire
    if (action === 'confirm' && booking.payment_status !== 'PAID' && !isAdmin) {
      return sendError(res, 402, 'Le client doit d\'abord payer pour que vous puissiez confirmer.');
    }

    const transitions = {
      confirm:  { from: ['PENDING'],            newStatus: 'CONFIRMED',              field: 'confirmed_at', allowedRoles: ['PRESTATAIRE','ADMIN'] },
      cancel:   { from: ['PENDING','CONFIRMED'], newStatus: isClient ? 'CANCELLED_CLIENT' : 'CANCELLED_PRESTATAIRE', field: 'cancelled_at', allowedRoles: ['CLIENT','PRESTATAIRE','ADMIN'] },
      complete: { from: ['CONFIRMED'],           newStatus: 'COMPLETED',              field: 'completed_at', allowedRoles: ['PRESTATAIRE','ADMIN'] },
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

// ── GET /api/bookings/payouts — Admin : voir les reversements dus ─────────────
const getPayouts = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return sendError(res, 403, 'Admin requis.');
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const { rows: payouts, count } = await PayoutRequest.findAndCountAll({
      where,
      include: [
        { model: Booking,     as: 'booking', attributes: ['id', 'booking_date', 'amount'] },
        { model: Prestataire, as: 'prestataire', attributes: ['id', 'display_name'],
          include: [{ model: User, as: 'user', attributes: ['email'] }] },
      ],
      order: [['created_at', 'DESC']],
      limit, offset, distinct: true,
    });

    // Totaux
    const [[totals]] = await sequelize.query(`
      SELECT 
        SUM(amount_total)   as total_collecte,
        SUM(commission_amt) as total_commission,
        SUM(payout_amt)     as total_a_reverser,
        SUM(CASE WHEN status='PAID' THEN payout_amt ELSE 0 END) as total_reverse,
        SUM(CASE WHEN status='PENDING' THEN payout_amt ELSE 0 END) as total_en_attente
      FROM payout_requests
    `);

    return sendSuccess(res, 200, 'Reversements récupérés.', {
      payouts,
      pagination: buildPaginationMeta(count, page, limit),
      totaux: totals,
    });
  } catch (error) { next(error); }
};

// ── PATCH /api/bookings/payouts/:id/pay — Admin marque un reversement effectué ─
const markPayoutPaid = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return sendError(res, 403, 'Admin requis.');
    const payout = await PayoutRequest.findByPk(req.params.id);
    if (!payout) return sendError(res, 404, 'Reversement introuvable.');
    if (payout.status === 'PAID') return sendError(res, 400, 'Déjà reversé.');

    await payout.update({ status: 'PAID', paid_at: new Date(), note: req.body.note || null });
    return sendSuccess(res, 200, 'Reversement marqué comme effectué.', { payout });
  } catch (error) { next(error); }
};

module.exports = {
  createBooking, getBookings, updateBookingStatus,
  handleBookingWebhook, getPayouts, markPayoutPaid,
};
