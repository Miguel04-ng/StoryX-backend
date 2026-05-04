/**
 * STORYX — Tests API v2 (MySQL)
 * npm test
 *
 * Prérequis : MySQL démarré avec la base storyx importée
 */

const request = require('supertest');
const app     = require('../app');

const ts = Date.now();

const clientData = {
  email:      `client.${ts}@storyx.cm`,
  password:   'Password1A',
  first_name: 'Jean',
  last_name:  'Test',
  role:       'CLIENT',
};

const prestaData = {
  email:      `presta.${ts}@storyx.cm`,
  password:   'Password1A',
  first_name: 'Marie',
  last_name:  'Prestataire',
  role:       'PRESTATAIRE',
};

let clientToken = '', clientId = '', clientRecordId = '';
let prestaToken = '', prestaId = '', prestaRecordId = '';
let bookingId   = '';

// ════════════════════════════════════════════════════
describe('HEALTH', () => {
  it('GET /api/health → 200 ou 503 (si MySQL non dispo)', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.statusCode);
    expect(res.body.version).toBe('2.0.0');
    expect(res.body.features.payments).toContain('cinetpay');
  });
});

// ════════════════════════════════════════════════════
describe('AUTH — /api/auth', () => {

  describe('POST /api/auth/register', () => {
    it('crée un compte client', async () => {
      const res = await request(app).post('/api/auth/register').send(clientData);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('CLIENT');
      expect(res.body.user.password).toBeUndefined();
      clientToken = res.body.token;
      clientId    = res.body.user.id;
    });

    it('crée un compte prestataire', async () => {
      const res = await request(app).post('/api/auth/register').send(prestaData);
      expect(res.statusCode).toBe(201);
      expect(res.body.user.role).toBe('PRESTATAIRE');
      prestaToken = res.body.token;
      prestaId    = res.body.user.id;
    });

    it('refuse email dupliqué → 409', async () => {
      const res = await request(app).post('/api/auth/register').send(clientData);
      expect(res.statusCode).toBe(409);
    });

    it('refuse mot de passe faible → 422', async () => {
      const res = await request(app).post('/api/auth/register').send({
        ...clientData, email: `weak.${ts}@test.cm`, password: 'abc'
      });
      expect(res.statusCode).toBe(422);
    });

    it('refuse email invalide → 422', async () => {
      const res = await request(app).post('/api/auth/register').send({
        ...clientData, email: 'pas-un-email'
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    it('connecte avec identifiants valides', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: clientData.email, password: clientData.password,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.is_premium).toBe(false);
    });

    it('refuse mauvais mot de passe → 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: clientData.email, password: 'WrongPass1',
      });
      expect(res.statusCode).toBe(401);
    });

    it('refuse email inexistant → 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'ghost@storyx.cm', password: 'Password1A',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('retourne le profil connecté', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.user.email).toBe(clientData.email);
    });

    it('refuse sans token → 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
    });

    it('refuse avec token invalide → 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');
      expect(res.statusCode).toBe(401);
    });
  });
});

// ════════════════════════════════════════════════════
describe('PROFILES — /api/profiles', () => {

  it('GET /api/profiles → liste paginée', async () => {
    const res = await request(app).get('/api/profiles');
    expect(res.statusCode).toBe(200);
    expect(res.body.profiles).toBeDefined();
    expect(Array.isArray(res.body.profiles)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /api/profiles?ville=Douala → filtre ville', async () => {
    const res = await request(app).get('/api/profiles?ville=Douala');
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/profiles?tri=populaire → tri note', async () => {
    const res = await request(app).get('/api/profiles?tri=populaire');
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/profiles → prestataire peut créer son profil', async () => {
    const res = await request(app)
      .post('/api/profiles')
      .set('Authorization', `Bearer ${prestaToken}`)
      .send({ display_name: 'Marie Pro', tarif_min: 15000, tarif_max: 30000, ville: 'Douala' });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.success).toBe(true);
    prestaRecordId = res.body.profile?.prestataire_id || prestaId;
  });

  it('POST /api/profiles refusé pour client → 403', async () => {
    const res = await request(app)
      .post('/api/profiles')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ display_name: 'Tentative', tarif_min: 5000 });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/profiles/:id → 404 si inexistant', async () => {
    const res = await request(app).get('/api/profiles/999999');
    expect(res.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════
describe('BOOKINGS — /api/bookings', () => {

  it('POST /api/bookings → client crée une réservation', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        prestataire_id: 1, // suppose qu'il existe en DB
        booking_date:   tomorrow,
        amount:         20000,
      });
    // 201 si prestataire existe, 404 sinon
    expect([201, 404]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      bookingId = res.body.booking.id;
      expect(res.body.demandesRestantes).toBeDefined();
    }
  });

  it('POST /api/bookings refusé pour prestataire → 403', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${prestaToken}`)
      .send({ prestataire_id: 1, booking_date: new Date(Date.now() + 86400000).toISOString(), amount: 10000 });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/bookings → liste des réservations du client', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
  });

  it('GET /api/bookings sans auth → 401', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/bookings/:id/status → prestataire confirme', async () => {
    if (!bookingId) return;
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${prestaToken}`)
      .send({ action: 'confirm' });
    expect([200, 403, 404]).toContain(res.statusCode);
  });
});

// ════════════════════════════════════════════════════
describe('MESSAGES — /api/messages', () => {

  it('POST /api/messages → client envoie un message', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ prestataire_id: 1, content: 'Bonjour, êtes-vous disponible ?' });
    expect([201, 404, 403]).toContain(res.statusCode);
  });

  it('GET /api/messages → liste des conversations', async () => {
    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.conversations)).toBe(true);
  });

  it('GET /api/messages/unread/count', async () => {
    const res = await request(app)
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(typeof res.body.unreadCount).toBe('number');
  });

  it('GET /api/messages sans auth → 401', async () => {
    const res = await request(app).get('/api/messages');
    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════
describe('REVIEWS — /api/reviews', () => {

  it('POST /api/reviews sans réservation terminée → 403', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ booking_id: 999, rating: 5, comment: 'Test' });
    expect([403, 404]).toContain(res.statusCode);
  });

  it('POST /api/reviews par prestataire → 403', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${prestaToken}`)
      .send({ booking_id: 1, rating: 5 });
    expect(res.statusCode).toBe(403);
  });

  it('POST /api/reviews note invalide → 422', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ booking_id: 1, rating: 10 });
    expect(res.statusCode).toBe(422);
  });

  it('GET /api/reviews/:prestataireId → avis avec stats', async () => {
    const res = await request(app)
      .get('/api/reviews/1')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.distribution).toBeDefined();
    expect(typeof res.body.stats.averageRating).toBe('number');
  });

  it('GET /api/reviews sans auth → 401', async () => {
    const res = await request(app).get('/api/reviews/1');
    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════
describe('PAYMENTS — /api/payments', () => {

  it('GET /api/payments/tarifs → retourne les tarifs CLIENT', async () => {
    const res = await request(app)
      .get('/api/payments/tarifs')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.role).toBe('CLIENT');
    expect(res.body.tarifs).toHaveLength(4);
    expect(res.body.tarifs[0].prix).toBe(5000);
    expect(res.body.providers.cinetpay).toBeDefined();
    expect(res.body.providers.flutterwave).toBeDefined();
  });

  it('GET /api/payments/tarifs → tarifs PRESTATAIRE plus élevés', async () => {
    const res = await request(app)
      .get('/api/payments/tarifs')
      .set('Authorization', `Bearer ${prestaToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.role).toBe('PRESTATAIRE');
    expect(res.body.tarifs[0].prix).toBe(10000);
  });

  it('POST /api/payments/initiate → provider invalide → 422', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ provider: 'paypal', method: 'MTN_MOMO', duree_mois: 1 });
    expect(res.statusCode).toBe(422);
  });

  it('POST /api/payments/initiate → durée invalide → 422', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ provider: 'cinetpay', method: 'MTN_MOMO', duree_mois: 7 });
    expect(res.statusCode).toBe(422);
  });

  it('POST /api/payments/initiate CinetPay → 200 ou 503 selon config', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ provider: 'cinetpay', method: 'MTN_MOMO', duree_mois: 1 });
    expect([200, 503]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body.paymentUrl).toBeDefined();
      expect(res.body.reference).toMatch(/^STX-/);
    }
  });

  it('POST /api/payments/initiate sans auth → 401', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .send({ provider: 'cinetpay', method: 'MTN_MOMO', duree_mois: 1 });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/payments/webhook/cinetpay → 200 immédiat (sécurité)', async () => {
    const res = await request(app)
      .post('/api/payments/webhook/cinetpay')
      .send({
        cpm_site_id:    'fake',
        cpm_trans_id:   'TXN001',
        cpm_custom:     'STX-FAKE-001',
        cpm_result:     '01',
        cpm_amount:     '5000',
        cpm_currency:   'XAF',
        payment_method: 'mtn_momo',
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('POST /api/payments/webhook/flutterwave → 200 immédiat', async () => {
    const res = await request(app)
      .post('/api/payments/webhook/flutterwave')
      .set('verif-hash', 'wrong-hash')
      .send({ event: 'charge.completed', data: { id: 1, tx_ref: 'STX-FAKE-002', status: 'failed' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('GET /api/payments/verify/STX-FAKE-REF → 404', async () => {
    const res = await request(app)
      .get('/api/payments/verify/STX-FAKE-REF-000')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/payments/history → historique vide ou rempli', async () => {
    const res = await request(app)
      .get('/api/payments/history')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.payments)).toBe(true);
  });
});

// ════════════════════════════════════════════════════
describe('SUBSCRIPTIONS — /api/subscriptions', () => {

  it('GET /api/subscriptions/status → statut freemium', async () => {
    const res = await request(app)
      .get('/api/subscriptions/status')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(res.body.status.isPremium).toBe(false);
    expect(res.body.status.limiteJournaliere).toBeDefined();
  });

  it('GET /api/subscriptions/history', async () => {
    const res = await request(app)
      .get('/api/subscriptions/history')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.subscriptions)).toBe(true);
  });
});

// ════════════════════════════════════════════════════
describe('ADMIN — /api/admin (accès refusé pour non-admin)', () => {

  it('GET /api/admin/stats → 403 pour client', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/admin/users → 403 pour prestataire', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${prestaToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/admin/* sans auth → 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════
describe('FREEMIUM — Limite journalière', () => {

  it('GET /api/subscriptions/status → demandesRestantes définie', async () => {
    const res = await request(app)
      .get('/api/subscriptions/status')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.body.status.demandesRestantes).toBeDefined();
    expect(res.body.status.limiteJournaliere).toBeDefined();
  });
});
