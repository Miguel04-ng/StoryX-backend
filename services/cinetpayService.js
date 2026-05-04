const axios = require('axios');

const BASE_URL  = process.env.CINETPAY_BASE_URL || 'https://api-checkout.cinetpay.com/v2';
const API_KEY   = process.env.CINETPAY_API_KEY;
const SITE_ID   = process.env.CINETPAY_SITE_ID;

const client = axios.create({ baseURL: BASE_URL, timeout: 30000 });

const initiatePayment = async ({ reference, amount, currency = 'XAF', description, customer, notifyUrl, returnUrl, cancelUrl }) => {
  if (!API_KEY || !SITE_ID) throw new Error('CinetPay : clés API manquantes (CINETPAY_API_KEY / CINETPAY_SITE_ID)');

  const payload = {
    apikey: API_KEY, site_id: SITE_ID,
    transaction_id: reference,
    amount, currency,
    description: description || 'StoryX Premium',
    customer_id:      customer.id,
    customer_name:    customer.surname || '',
    customer_surname: customer.name   || '',
    customer_email:   customer.email  || '',
    customer_phone_number: customer.phone || '',
    customer_address: '', customer_city: '', customer_country: customer.country || 'CM',
    customer_state: 'CM', customer_zip_code: '00000',
    notify_url: notifyUrl, return_url: returnUrl, cancel_url: cancelUrl,
    channels: 'ALL', metadata: reference, lang: 'fr',
  };

  const res = await client.post('/payment', payload);
  if (res.data.code !== '201') {
    throw new Error(`CinetPay : ${res.data.message} (code ${res.data.code})`);
  }
  return { paymentUrl: res.data.data.payment_url, payToken: res.data.data.pay_token };
};

const verifyTransaction = async (transactionId) => {
  if (!API_KEY || !SITE_ID) throw new Error('CinetPay : clés API manquantes');
  const res = await client.post('/payment/check', { apikey: API_KEY, site_id: SITE_ID, transaction_id: transactionId });
  if (res.data.code !== '00') throw new Error(`CinetPay vérif : ${res.data.message}`);
  const d = res.data.data;
  return {
    status:        d.status,
    amount:        d.amount,
    currency:      d.currency,
    transactionId: d.cpm_trans_id,
    isSuccess:     d.status === 'ACCEPTED',
  };
};

const verifyWebhookSignature = (payload) => {
  if (!SITE_ID) return true;
  return payload?.cpm_site_id === SITE_ID;
};

const parseWebhookPayload = (body) => ({
  transactionId: body.cpm_trans_id,
  reference:     body.cpm_custom || body.transaction_id,
  status:        body.cpm_result,
  amount:        body.cpm_amount,
  currency:      body.cpm_currency,
  isSuccess:     body.cpm_result === '00',
  errorMessage:  body.cpm_error_message,
});

module.exports = { initiatePayment, verifyTransaction, verifyWebhookSignature, parseWebhookPayload };
