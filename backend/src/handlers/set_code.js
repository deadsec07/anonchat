const { getConnection, listConnectionsByRoom } = require('../lib/dynamo');
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };
  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch (_) {}
  const newCode = (body.code || '').toString().trim().slice(0, 32);
  if (!newCode) return { statusCode: 400, body: 'Missing code' };
  try {
    const me = await getConnection(connectionId);
    if (!me || !me.roomId) return { statusCode: 400, body: 'Join a room first' };
    if (String(me.roomId) === 'lobby') return { statusCode: 400, body: 'Cannot set code in lobby' };
    const roomId = String(me.roomId);
    const crypto = require('crypto');
    const salt = crypto.randomBytes(12).toString('hex');
    const hash = crypto.createHash('sha256').update(salt + newCode).digest('hex');
    const list = await listConnectionsByRoom(roomId);
    // Update all connections in this room with new salt/hash
    for (const it of list || []) {
      if (!it || !it.connectionId) continue;
      await dynamo.update({
        TableName: TABLE_NAME,
        Key: { connectionId: it.connectionId },
        UpdateExpression: 'SET roomCodeSalt = :s, roomCodeHash = :h',
        ExpressionAttributeValues: { ':s': salt, ':h': hash },
      }).promise();
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('set_code error', err);
    return { statusCode: 500, body: 'Failed to set code' };
  }
};
