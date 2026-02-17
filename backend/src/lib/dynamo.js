const AWS = require('aws-sdk');

const TABLE_NAME = process.env.TABLE_NAME;
const dynamo = new AWS.DynamoDB.DocumentClient();

function ttlSeconds(days = 2) {
  const now = Math.floor(Date.now() / 1000);
  return now + days * 24 * 60 * 60;
}

async function putConnection(connectionId) {
  const item = {
    connectionId,
    createdAt: new Date().toISOString(),
    expiresAt: ttlSeconds(2),
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

async function setRoomAndAlias(connectionId, roomId, alias) {
  const params = {
    TableName: TABLE_NAME,
    Key: { connectionId },
    UpdateExpression: 'SET roomId = :r, alias = :a, expiresAt = :e',
    ExpressionAttributeValues: {
      ':r': roomId,
      ':a': alias,
      ':e': ttlSeconds(2),
    },
    ReturnValues: 'ALL_NEW',
  };
  const res = await dynamo.update(params).promise();
  return res.Attributes;
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

