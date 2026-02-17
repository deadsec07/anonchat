const { setRoomAndAlias, listConnectionsByRoom, deleteConnection } = require('../lib/dynamo');
const { broadcast } = require('../lib/broadcast');

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };

  let body = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch (_) {}

  const roomId = (body.roomId || '').toString().trim().slice(0, 64) || 'lobby';
  let alias = (body.alias || '').toString().trim().slice(0, 32) || 'anon';

  try {
    // Enforce alias uniqueness within the room (best-effort)
    const existing = await listConnectionsByRoom(roomId);
    const used = new Set((existing || []).map((x) => (x.alias || '').toString()));
    if (used.has(alias)) {
      const base = alias;
      for (let i = 2; i < 1000; i++) {
        const suffix = `-${i}`;
        const maxBase = 32 - suffix.length;
        const candidate = (base.slice(0, Math.max(1, maxBase)) + suffix).slice(0, 32);
        if (!used.has(candidate)) {
          alias = candidate;
          break;
        }
      }
    }

    const me = await setRoomAndAlias(connectionId, roomId, alias);
    const recipients = await listConnectionsByRoom(roomId);

    await broadcast(
      event,
      recipients,
      {
        type: 'system',
        event: 'join',
        roomId,
        text: `${alias} joined`,
        count: (recipients || []).length,
        ts: Date.now(),
      },
      deleteConnection
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, me: { connectionId: me.connectionId, roomId, alias } }),
    };
  } catch (err) {
    console.error('join error', err);
    return { statusCode: 500, body: 'Failed to join' };
  }
};
