const { putConnection } = require('../lib/dynamo');

exports.handler = async (event) => {
  const connectionId = event.requestContext && event.requestContext.connectionId;
  if (!connectionId) {
    return { statusCode: 500, body: 'No connectionId' };
  }
  try {
    await putConnection(connectionId);
    return { statusCode: 200, body: 'Connected' };
  } catch (err) {
    console.error('connect error', err);
    return { statusCode: 500, body: 'Failed to connect' };
  }
};

