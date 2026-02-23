const https = require('https');
const { URL } = require('url');
const { webcrypto: { subtle } } = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function b64urlToBuf(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

async function vapidJwt(publicKeyB64, privateKeyB64, aud, sub, expSeconds = 12 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = { aud, exp: now + expSeconds, sub: sub || 'mailto:admin@example.com' };
  const token = `${b64url(Buffer.from(JSON.stringify(header)))}.${b64url(Buffer.from(JSON.stringify(payload)))}`;
  // Build JWK from raw keys
  const pub = b64urlToBuf(publicKeyB64);
  const d = b64urlToBuf(privateKeyB64);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('Invalid VAPID public key');
  const x = b64url(pub.slice(1, 33));
  const y = b64url(pub.slice(33, 65));
  const jwk = { crv: 'P-256', kty: 'EC', x, y, d: b64url(d) };
  const key = await subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(token));
  const signature = b64url(Buffer.from(sig));
  return `${token}.${signature}`;
}

async function sendNoPayload(subscription, { publicKey, privateKey, subject } = {}) {
  if (!subscription || !subscription.endpoint) throw new Error('Missing subscription');
  const endpoint = subscription.endpoint;
  const u = new URL(endpoint);
  const aud = `${u.protocol}//${u.host}`;
  const jwt = await vapidJwt(publicKey, privateKey, aud, subject);
  const headers = {
    TTL: '60',
    Authorization: `WebPush ${jwt}`,
    'Content-Length': '0',
    'Crypto-Key': `p256ecdsa=${publicKey}`,
  };
  return new Promise((resolve) => {
    const req = https.request(endpoint, { method: 'POST', headers }, (res) => {
      // 201 Created typical
      res.on('data', () => {});
      res.on('end', () => resolve({ statusCode: res.statusCode }));
    });
    req.on('error', () => resolve({ statusCode: 0 }));
    req.end();
  });
}

module.exports = { sendNoPayload };

