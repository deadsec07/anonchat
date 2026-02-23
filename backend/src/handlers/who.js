const { getConnection, listConnectionsByRoom } = require('../lib/dynamo');
const { broadcast } = require('../lib/broadcast');

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };
  try {
    const me = await getConnection(connectionId);
    if (!me || !me.roomId) return { statusCode: 400, body: 'Join a room first' };
    const list = await listConnectionsByRoom(me.roomId);
    const nowSec = Math.floor(Date.now() / 1000);
    const ACTIVE_WINDOW = 180; // seconds
    const users = (list || [])
      .filter((x) => {
        if (!x || !x.alias) return false;
        const la = Number(x.lastActiveAt) || 0;
        if (la && (nowSec - la) <= ACTIVE_WINDOW) return true;
        if (x.createdAt) {
          const t = Date.parse(String(x.createdAt));
          if (!Number.isNaN(t) && (Date.now() - t) <= ACTIVE_WINDOW * 1000) return true;
        }
        return false;
      })
      .map((x) => ({ alias: String(x.alias) }));
    const payload = { type: 'who', roomId: me.roomId, users, ts: Date.now() };
    await broadcast(event, [{ connectionId }], payload);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('who error', err);
    return { statusCode: 500, body: 'Failed to list users' };
  }
};
