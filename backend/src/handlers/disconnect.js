const { deleteConnection, getConnection, listConnectionsByRoom } = require('../lib/dynamo');
const { broadcast } = require('../lib/broadcast');

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };
  try {
    // Capture room/alias before delete
    const me = await getConnection(connectionId);
    await deleteConnection(connectionId);

    if (me && me.roomId) {
      const recipients = await listConnectionsByRoom(me.roomId);
      await broadcast(event, recipients, {
        type: 'system',
        event: 'leave',
        roomId: me.roomId,
        text: `${me.alias || 'anon'} left`,
        count: (recipients || []).length,
        ts: Date.now(),
      });
    }

    return { statusCode: 200, body: 'Disconnected' };
  } catch (err) {
    console.error('disconnect error', err);
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
};
