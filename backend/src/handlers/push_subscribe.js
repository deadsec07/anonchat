const { getConnection, setRoomAndAlias } = require('../lib/dynamo');

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };
  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch (_) {}
  const subscription = body && body.subscription ? body.subscription : null;
  if (!subscription) return { statusCode: 400, body: 'Missing subscription' };
  try {
    const me = await getConnection(connectionId);
    if (!me) return { statusCode: 400, body: 'Not connected' };
    // Persist subscription on connection record via setRoomAndAlias (no alias/room change)
    await setRoomAndAlias(connectionId, me.roomId || me.roomId || 'lobby', me.alias || 'anon', { pushSub: subscription });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('push_subscribe error', err);
    return { statusCode: 500, body: 'Failed to save subscription' };
  }
};

