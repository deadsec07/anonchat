const { getConnection, listConnectionsByRoom, deleteConnection, rateLimitCheck } = require('../lib/dynamo');
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
  const replyTo = body.replyTo && typeof body.replyTo === 'object' ? {
    id: String(body.replyTo.id || '').slice(0, 64),
    alias: String(body.replyTo.alias || '').slice(0, 64),
    text: String(body.replyTo.text || '').slice(0, 256)
  } : null;
  if (!text) return { statusCode: 400, body: 'Empty message' };
  if (text.length > 512) return { statusCode: 400, body: 'Message too long' };

  try {
    const me = await getConnection(connectionId);
    if (!me || !me.roomId) {
      return { statusCode: 400, body: 'Join a room first' };
    }

    // Simple per-connection rate limit
    const rl = await rateLimitCheck(connectionId, { limit: 30, windowSec: 60 });
    if (!rl.allowed) {
      // Inform only the sender
      await broadcast(
        event,
        [me],
        {
          type: 'system',
          event: 'rate_limited',
          roomId: me.roomId,
          text: 'Too many messages; slow down',
          ts: Date.now(),
          limit: 30,
          remaining: rl.remaining,
        }
      );
      return { statusCode: 429, body: 'Rate limited' };
    }

    const recipients = await listConnectionsByRoom(me.roomId);
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
    const message = {
      type: 'message',
      id: id(),
      roomId: me.roomId,
      alias: me.alias || 'anon',
      text,
      ts: Date.now(),
      replyTo: replyTo || undefined,
      attachment: attachment || undefined,
    };

    await broadcast(event, recipients, message, deleteConnection);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('send error', err);
    return { statusCode: 500, body: 'Failed to send' };
  }
};
