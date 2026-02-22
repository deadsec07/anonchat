const { getConnection, listConnectionsByRoom } = require('../lib/dynamo');
const { broadcast } = require('../lib/broadcast');

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };
  try {
    const me = await getConnection(connectionId);
    if (!me || !me.roomId) return { statusCode: 400, body: 'Join a room first' };
    const list = await listConnectionsByRoom(me.roomId);
    const users = (list || [])
      .filter((x) => x && x.alias)
      .map((x) => ({ alias: String(x.alias) }));
    const payload = { type: 'who', roomId: me.roomId, users, ts: Date.now() };
    await broadcast(event, [{ connectionId }], payload);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('who error', err);
    return { statusCode: 500, body: 'Failed to list users' };
  }
};
