const AWS = require('aws-sdk');

function managementApiFrom(event) {
  const { domainName, stage } = event.requestContext || {};
  const endpoint = `https://${domainName}/${stage}`;
  return new AWS.ApiGatewayManagementApi({ endpoint });
}

async function broadcast(event, recipients, payload, onGone) {
  const apigw = managementApiFrom(event);
  const data = Buffer.from(JSON.stringify(payload));

  for (const r of recipients) {
    if (!r || !r.connectionId) continue;
    try {
      await apigw
        .postToConnection({ ConnectionId: r.connectionId, Data: data })
        .promise();
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        if (onGone) await onGone(r.connectionId);
      } else {
        console.error('postToConnection error', err);
      }
    }
  }
}

module.exports = { broadcast };

