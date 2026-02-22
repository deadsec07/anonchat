const AWS = require('aws-sdk');
const { broadcast } = require('../lib/broadcast');

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };

  try {
    // Scan table for room membership; cheap at small scale
    let items = [];
    let ExclusiveStartKey;
    do {
      const res = await dynamo
        .scan({
          TableName: TABLE_NAME,
          ProjectionExpression: 'roomId, roomCode',
          ExclusiveStartKey,
        })
        .promise();
      items = items.concat(res.Items || []);
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    const counts = new Map();
    const priv = new Map();
    let total = 0;
    for (const it of items) {
      const r = (it && it.roomId) || null;
      if (!r) continue;
      total += 1;
      counts.set(r, (counts.get(r) || 0) + 1);
      if (it && (it.roomCode || it.roomCodeHash)) priv.set(r, true);
    }

    const rooms = Array.from(counts.entries())
      .map(([roomId, count]) => ({ roomId, count, private: !!priv.get(roomId) }))
      .sort((a, b) => b.count - a.count || a.roomId.localeCompare(b.roomId));

    await broadcast(event, [{ connectionId }], {
      type: 'rooms',
      total,
      rooms,
      ts: Date.now(),
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('rooms error', err);
    return { statusCode: 500, body: 'Failed to list rooms' };
  }
};
