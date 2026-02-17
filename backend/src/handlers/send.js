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
  if (!text) return { statusCode: 400, body: 'Empty message' };

  try {
    const me = await getConnection(connectionId);
    if (!me || !me.roomId) {
      return { statusCode: 400, body: 'Join a room first' };
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

