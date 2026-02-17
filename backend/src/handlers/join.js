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
  const alias = (body.alias || '').toString().trim().slice(0, 32) || 'anon';

  try {
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

