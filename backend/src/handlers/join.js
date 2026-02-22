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
  const clientId = ((body.clientId || '') + '').replace(/[^a-zA-Z0-9]/g, '');
  const quiet = !!body.quiet;
  const providedCode = (body.code || '').toString().trim().slice(0, 32);

  try {
    // Enforce room code if needed; allow creating a private room when empty
    const existing = await listConnectionsByRoom(roomId);
    let existingCode = null;
    for (const x of existing || []) {
      if (x && x.roomCode) { existingCode = (x.roomCode + '').trim(); break; }
    }
    if (existing.length > 0 && existingCode) {
      if (!providedCode || providedCode !== existingCode) {
        // Notify only sender
        await broadcast(event, [{ connectionId }], {
          type: 'system', event: 'error', roomId, text: 'Invalid room code', ts: Date.now()
        });
        return { statusCode: 200, body: 'Invalid room code' };
      }
    }

    // Compute final alias: only suffix when duplicate base alias exists in room
    const base = alias || 'anon';
    const suff = clientId ? `-${clientId.slice(-6)}` : '';
    let finalAlias = base;
    const hasExact = (existing || []).some((x) => x && String(x.alias) === base);
    if (hasExact && suff) {
      const maxBase = Math.max(1, 32 - suff.length);
      finalAlias = base.slice(0, maxBase) + suff;
    }
    alias = finalAlias;

    // Determine room code to persist on this connection
    let roomCodeToSet = null;
    if (existing.length === 0 && providedCode) roomCodeToSet = providedCode;
    if (existing.length > 0 && existingCode) roomCodeToSet = existingCode;

    const me = await setRoomAndAlias(connectionId, roomId, alias, roomCodeToSet ? { roomCode: roomCodeToSet } : {});
    // Inform the sender of their resolved alias
    await broadcast(event, [{ connectionId }], {
      type: 'me', event: 'joined', roomId, alias: me.alias, ts: Date.now()
    });
    const recipients = await listConnectionsByRoom(roomId);

    if (!quiet) {
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
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, me: { connectionId: me.connectionId, roomId, alias } }),
    };
  } catch (err) {
    console.error('join error', err);
    return { statusCode: 500, body: 'Failed to join' };
  }
};
