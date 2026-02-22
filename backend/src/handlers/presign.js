const AWS = require('aws-sdk');
const { getConnection } = require('../lib/dynamo');

const s3 = new AWS.S3({ signatureVersion: 'v4' });
const BUCKET = process.env.ATTACH_BUCKET;

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };
  if (!BUCKET) return { statusCode: 500, body: 'Missing bucket' };
  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch (_) {}

  const name = (body.name || '').toString().slice(0, 128) || 'upload';
  const type = (body.type || '').toString();
  const size = Number(body.size || 0);
  const scope = (body.scope || 'room').toString();
  // Validate: images only, modest size
  if (!/^image\//.test(type)) return { statusCode: 400, body: 'Only images allowed' };
  if (!(size > 0 && size <= 5 * 1024 * 1024)) return { statusCode: 400, body: 'Too large' };

  try {
    const me = await getConnection(connectionId);
    const { rateLimitCheck } = require('../lib/dynamo');
    const rl = await rateLimitCheck(connectionId, { limit: 10, windowSec: 60 });
    if (!rl.allowed) return { statusCode: 429, body: 'Rate limited' };
    const roomId = me && me.roomId ? String(me.roomId) : 'room';
    const key = `uploads/${roomId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}-${name.replace(/[^a-zA-Z0-9_.-]/g, '-')}`;
    const Expires = 300; // 5 minutes
    const uploadUrl = await s3.getSignedUrlPromise('putObject', { Bucket: BUCKET, Key: key, ContentType: type, Expires });
    const getUrl = await s3.getSignedUrlPromise('getObject', { Bucket: BUCKET, Key: key, Expires });
    // Reply only to requester via management API
    const { broadcast } = require('../lib/broadcast');
    await broadcast(event, [{ connectionId }], { type: 'presign', scope, key, uploadUrl, getUrl, expiresIn: Expires, ts: Date.now() });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('presign error', err);
    return { statusCode: 500, body: 'Failed to presign' };
  }
};
