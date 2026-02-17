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
    const message = {
      type: 'message',
      id: id(),
      roomId: me.roomId,
      alias: me.alias || 'anon',
      text,
      ts: Date.now(),
    };

    await broadcast(event, recipients, message, deleteConnection);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('send error', err);
    return { statusCode: 500, body: 'Failed to send' };
  }
};
