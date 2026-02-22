const { getConnection, listConnectionsByRoom, deleteConnection } = require('../lib/dynamo');
const { broadcast } = require('../lib/broadcast');

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };

  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch (_) {}
  const isTyping = !!body.typing;
  const to = (body.to || '').toString().trim();

  try {
    const me = await getConnection(connectionId);
    if (!me || !me.roomId) return { statusCode: 200, body: 'noop' };
    const { rateLimitCheck } = require('../lib/dynamo');
    const rl = await rateLimitCheck(connectionId, { limit: 60, windowSec: 60 });
    if (!rl.allowed) return { statusCode: 200, body: 'noop' };
    // DM-only typing: require a recipient alias in same room
    if (!to) return { statusCode: 200, body: 'noop' };
    const all = await listConnectionsByRoom(me.roomId);
    const recipients = all.filter((x) => x && x.alias === to);
    if (!recipients.length) return { statusCode: 200, body: 'noop' };
    const payload = {
      type: 'system',
      event: 'typing',
      roomId: me.roomId,
      alias: me.alias || 'anon',
      to,
      typing: isTyping,
      ts: Date.now(),
    };
    // Only send to the recipient; sender doesn't need an echo
    await broadcast(event, recipients, payload, deleteConnection);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('typing error', err);
    return { statusCode: 500, body: 'Failed to send typing' };
  }
};
