const axios = require('axios');

const BASE_URL   = process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3';
const SECRET_KEY = () => process.env.FLUTTERWAVE_SECRET_KEY;

const client = axios.create({ baseURL: BASE_URL, timeout: 30000 });
client.interceptors.request.use(cfg => {
  cfg.headers['Authorization'] = `Bearer ${SECRET_KEY()}`;
  return cfg;
});

const mapMethod = (method) => {
  const map = { MTN_MOMO: 'mobilemoneyfrancophone', ORANGE_MONEY: 'mobilemoneyfrancophone', CARD: 'card', WAVE: 'mobilemoneyfrancophone' };
  return map[method] || 'card,mobilemoneyfrancophone';
};

const initiatePayment = async ({ reference, amount, currency = 'XAF', method, customer, redirectUrl, description }) => {
  if (!SECRET_KEY()) throw new Error('Flutterwave : FLUTTERWAVE_SECRET_KEY manquant');

  const res = await client.post('/payments', {
    tx_ref: reference, amount, currency,
    redirect_url:    redirectUrl,
    payment_options: mapMethod(method),
    meta:            { storyx_reference: reference },
    customer: { email: customer.email, phonenumber: customer.phone || '', name: customer.name },
    customizations: { title: 'StoryX Premium', description: description || 'Abonnement StoryX' },
  });

  if (res.data.status !== 'success') throw new Error(`Flutterwave : ${res.data.message}`);
  return { paymentUrl: res.data.data.link };
};

const verifyTransaction = async (transactionId) => {
  if (!SECRET_KEY()) throw new Error('Flutterwave : FLUTTERWAVE_SECRET_KEY manquant');
  const res = await client.get(`/transactions/${transactionId}/verify`);
  if (res.data.status !== 'success') throw new Error(`Flutterwave vérif : ${res.data.message}`);
  const tx = res.data.data;
  return {
    status:        tx.status,
    amount:        tx.amount,
    currency:      tx.currency,
    transactionId: tx.id.toString(),
    reference:     tx.tx_ref,
    isSuccess:     tx.status === 'successful',
  };
};

const verifyWebhookSignature = (signature) => {
  if (!SECRET_KEY()) return true;
  return signature === SECRET_KEY();
};

const parseWebhookPayload = (body) => {
  const data = body.data || {};
  return {
    event:         body.event,
    transactionId: data.id?.toString(),
    reference:     data.tx_ref,
    status:        data.status,
    amount:        data.amount,
    currency:      data.currency,
    isSuccess:     data.status === 'successful' && body.event === 'charge.completed',
  };
};

module.exports = { initiatePayment, verifyTransaction, verifyWebhookSignature, parseWebhookPayload };
