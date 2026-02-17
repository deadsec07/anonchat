const { deleteConnection } = require('../lib/dynamo');

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 400, body: 'Missing connectionId' };
  try {
    await deleteConnection(connectionId);
    return { statusCode: 200, body: 'Disconnected' };
  } catch (err) {
    console.error('disconnect error', err);
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
};

