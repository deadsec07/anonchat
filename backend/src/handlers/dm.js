const { getConnection, listConnectionsByRoom, deleteConnection } = require('../lib/dynamo');
const { broadcast } = require('../lib/broadcast');

function id() {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${rnd}`;
}

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };

  let body = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch (_) {}

  const text = (body.text || '').toString().trim();
  const to = (body.to || '').toString().trim();
  if (!text) return { statusCode: 400, body: 'Empty message' };
  if (!to) return { statusCode: 400, body: 'Missing recipient' };
  if (text.length > 512) return { statusCode: 400, body: 'Message too long' };

  try {
    const me = await getConnection(connectionId);
    if (!me || !me.roomId) return { statusCode: 400, body: 'Join a room first' };
    const { rateLimitCheck } = require('../lib/dynamo');
    const rl = await rateLimitCheck(connectionId, { limit: 20, windowSec: 60 });
    if (!rl.allowed) {
      await broadcast(event, [{ connectionId }], { type: 'system', event: 'rate_limited', roomId: me.roomId, text: 'Too many DMs; slow down', ts: Date.now() });
      return { statusCode: 429, body: 'Rate limited' };
    }

    if (to && to === (me.alias || '')) {
      // Inform only the sender: cannot DM yourself
      await broadcast(event, [{ connectionId }], {
        type: 'system', event: 'error', roomId: me.roomId, text: 'Cannot DM yourself', ts: Date.now()
      });
      return { statusCode: 400, body: 'Cannot DM yourself' };
    }

    const all = await listConnectionsByRoom(me.roomId);
    const recipients = all.filter((x) => x && x.alias === to);
    if (!recipients.length) return { statusCode: 404, body: 'Recipient not found' };

    // Optional small attachment (image only, <=100KB data URL)
    let attachment = undefined;
    if (body.attachment && typeof body.attachment === 'object') {
      const a = body.attachment;
      const name = (a.name || '').toString().slice(0, 128);
      const type = (a.type || '').toString();
      const size = Number(a.size || 0);
      const data = (a.data || '').toString();
      const okType = /^image\//.test(type);
      const okSize = size > 0 && size <= 100 * 1024 && data.length <= 160000;
      const okData = /^data:image\//.test(data);
      if (name && okType && okSize && okData) attachment = { name, type, size, data };
    }

    const payload = {
      type: 'dm',
      id: id(),
      roomId: me.roomId,
      from: me.connectionId,
      alias: me.alias || 'anon',
      to,
      text,
      attachment: attachment || undefined,
      ts: Date.now(),
    };

    // include sender so they see their own DM
    await broadcast(event, [...recipients, { connectionId }], payload, deleteConnection);
    // Best-effort push notify for recipients
    try {
      const pub = process.env.VAPID_PUBLIC_KEY;
      const priv = process.env.VAPID_PRIVATE_KEY;
      const sub = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
      if (pub && priv) {
        const { sendNoPayload } = require('../lib/webpush');
        await Promise.allSettled((recipients || []).map((r) => {
          const s = r && r.pushSub;
          if (!s || !s.endpoint) return Promise.resolve();
          return sendNoPayload(s, { publicKey: pub, privateKey: priv, subject: sub });
        }));
      }
    } catch (e) { console.error('push send error', e); }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('dm error', err);
    return { statusCode: 500, body: 'Failed to send dm' };
  }
};
