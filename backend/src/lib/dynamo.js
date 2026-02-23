const AWS = require('aws-sdk');

const TABLE_NAME = process.env.TABLE_NAME;
const dynamo = new AWS.DynamoDB.DocumentClient();

function ttlSeconds(days = 2) {
  const now = Math.floor(Date.now() / 1000);
  return now + days * 24 * 60 * 60;
}

function shortUniq(len = 6) {
  // compact, reasonably unique per connection
  return Math.random().toString(36).slice(2, 2 + len);
}

async function putConnection(connectionId) {
  const item = {
    connectionId,
    createdAt: new Date().toISOString(),
    expiresAt: ttlSeconds(1),
    lastActiveAt: Math.floor(Date.now() / 1000),
    uniq: shortUniq(6),
  };
  await dynamo.put({ TableName: TABLE_NAME, Item: item }).promise();
  return item;
}

async function deleteConnection(connectionId) {
  await dynamo
    .delete({ TableName: TABLE_NAME, Key: { connectionId } })
    .promise();
}

async function getConnection(connectionId) {
  const res = await dynamo
    .get({ TableName: TABLE_NAME, Key: { connectionId } })
    .promise();
  return res.Item || null;
}

async function setRoomAndAlias(connectionId, roomId, alias, extra = {}) {
  let update = 'SET roomId = :r, alias = :a, expiresAt = :e, lastActiveAt = :la';
  const values = {
    ':r': roomId,
    ':a': (alias || 'anon').toString().slice(0, 32),
    ':e': ttlSeconds(1),
    ':la': Math.floor(Date.now() / 1000),
  };
  if (extra.roomCode) {
    update += ', roomCode = :c';
    values[':c'] = (extra.roomCode + '').slice(0, 32);
  }
  if (extra.roomCodeSalt && extra.roomCodeHash) {
    update += ', roomCodeSalt = :s, roomCodeHash = :h';
    values[':s'] = String(extra.roomCodeSalt);
    values[':h'] = String(extra.roomCodeHash);
  }
  if (extra.pushSub) {
    update += ', pushSub = :ps';
    values[':ps'] = extra.pushSub;
  }
  const params = {
    TableName: TABLE_NAME,
    Key: { connectionId },
    UpdateExpression: update,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  };
  const upd = await dynamo.update(params).promise();
  return upd.Attributes;
}

async function listConnectionsByRoom(roomId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI_Room',
    KeyConditionExpression: 'roomId = :r',
    ExpressionAttributeValues: { ':r': roomId },
  };
  const res = await dynamo.query(params).promise();
  return res.Items || [];
}

module.exports = {
  putConnection,
  deleteConnection,
  getConnection,
  setRoomAndAlias,
  listConnectionsByRoom,
};

// Simple per-connection rate limiter using attributes on the connection item.
// Windowed counter: resets every `windowSec`, allows up to `limit` messages.
async function rateLimitCheck(connectionId, { limit = 30, windowSec = 60 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const newResetAt = now + windowSec;
  // Try to reset window if expired or not set
  try {
    await dynamo
      .update({
        TableName: TABLE_NAME,
        Key: { connectionId },
        UpdateExpression: 'SET rlResetAt = :r, rlCount = :one, lastActiveAt = :now',
        ConditionExpression: 'attribute_not_exists(rlResetAt) OR rlResetAt < :now',
        ExpressionAttributeValues: { ':r': newResetAt, ':one': 1, ':now': now },
        ReturnValues: 'UPDATED_NEW',
      })
      .promise();
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: newResetAt };
  } catch (err) {
    if (err.code !== 'ConditionalCheckFailedException') throw err;
  }

  // Same window: increment count
  const res = await dynamo
    .update({
      TableName: TABLE_NAME,
      Key: { connectionId },
      UpdateExpression: 'SET lastActiveAt = :now ADD rlCount :one',
      ExpressionAttributeValues: { ':one': 1, ':now': now },
      ReturnValues: 'ALL_NEW',
    })
    .promise();

  const count = (res.Attributes && res.Attributes.rlCount) || 0;
  const resetAt = (res.Attributes && res.Attributes.rlResetAt) || newResetAt;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
}

module.exports.rateLimitCheck = rateLimitCheck;
